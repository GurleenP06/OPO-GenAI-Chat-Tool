import os
import torch
import logging
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
import config
from retriever import retrieve_knowledge
import re
from typing import List, Dict, Tuple
import json

tokenizer = AutoTokenizer.from_pretrained(config.MODEL_PATH, local_files_only=True)

bnb_config = BitsAndBytesConfig(
    load_in_4bit=True, 
    bnb_4bit_compute_dtype=torch.float16, 
    bnb_4bit_use_double_quant=True, 
    llm_int8_enable_fp32_cpu_offload=True
)

llm_model = AutoModelForCausalLM.from_pretrained(
    config.MODEL_PATH, 
    local_files_only=True, 
    quantization_config=bnb_config, 
    torch_dtype=torch.float16
).to(config.DEVICE)

SOURCE_USAGE_THRESHOLD = 100

def extract_sentence_chunks(text: str, chunk_size: int = 3) -> List[Tuple[str, int, int]]:
    """Extract sentences from text and group them into chunks for citation."""
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks = []
    
    for i in range(0, len(sentences), chunk_size):
        chunk = ' '.join(sentences[i:i+chunk_size])
        start_pos = text.find(chunk)
        end_pos = start_pos + len(chunk) if start_pos != -1 else -1
        chunks.append((chunk, start_pos, end_pos))
    
    return chunks

def find_relevant_passages(response_sentence: str, retrieved_docs: List[str], 
                          retrieved_metadata: List[Dict], threshold: float = 0.3) -> List[Dict]:
    """Find which retrieved passages are relevant to a response sentence."""
    relevant_passages = []
    
    # Normalize the response sentence
    response_words = set(response_sentence.lower().split())
    
    for doc, meta in zip(retrieved_docs, retrieved_metadata):
        # Split document into sentences
        doc_sentences = re.split(r'(?<=[.!?])\s+', doc)
        
        for idx, sent in enumerate(doc_sentences):
            sent_words = set(sent.lower().split())
            
            # Calculate overlap
            overlap = len(response_words.intersection(sent_words))
            if overlap >= len(response_words) * threshold and overlap > 2:
                # Extract a larger context around the sentence
                start_idx = max(0, idx - 1)
                end_idx = min(len(doc_sentences), idx + 2)
                context = ' '.join(doc_sentences[start_idx:end_idx])
                
                relevant_passages.append({
                    'filename': meta['filename'],
                    'source_url': meta['source_url'],
                    'passage': context,
                    'passage_index': idx,
                    'full_text': doc
                })
                break
    
    return relevant_passages

def track_source_usage(response: str, sources: List[Dict]) -> Dict[int, List[str]]:
    """Track which sources were used for which parts of the response."""
    source_usage = {}
    
    # Extract citation numbers from response
    citations = re.findall(r'\[(\d+)\]', response)
    
    for citation in citations:
        citation_num = int(citation)
        if citation_num <= len(sources):
            # Find the sentence containing this citation
            pattern = rf'[^.]*\[{citation}\][^.]*\.'
            matches = re.findall(pattern, response)
            
            for match in matches:
                # Clean the match
                clean_match = re.sub(r'\[\d+\]', '', match).strip()
                
                if citation_num not in source_usage:
                    source_usage[citation_num] = []
                
                # Find relevant passage in the source
                source = sources[citation_num - 1]
                doc_sentences = re.split(r'(?<=[.!?])\s+', source[0])
                
                # Find best matching sentences
                best_matches = []
                match_words = set(clean_match.lower().split())
                
                for i, sent in enumerate(doc_sentences):
                    sent_words = set(sent.lower().split())
                    overlap = len(match_words.intersection(sent_words))
                    
                    if overlap > len(match_words) * 0.3:
                        best_matches.append((i, sent, overlap))
                
                # Sort by overlap and take top matches
                best_matches.sort(key=lambda x: x[2], reverse=True)
                for idx, sent, _ in best_matches[:2]:
                    source_usage[citation_num].append(sent)
    
    return source_usage

def generate_response_with_citations(query, history=None, max_new_tokens=1024, temperature=0.7):
    """Generate response with inline citations and passage highlighting info."""
    try:
        candidates = retrieve_knowledge(query, top_k=10)
        retrieved_docs = [doc for doc, meta in candidates]
        retrieved_metadata = [meta for doc, meta in candidates]
        
        meaningful_retrievals = [(doc.strip(), meta) for doc, meta in candidates if len(doc.strip()) > 100]
        meaningful_docs = [doc for doc, meta in meaningful_retrievals]
        meaningful_metadata = [meta for doc, meta in meaningful_retrievals]

        # Create context with document indices
        context_section = ""
        doc_mapping = {}  # Maps doc index to metadata
        
        if meaningful_docs:
            context_parts = []
            for idx, (doc, meta) in enumerate(meaningful_retrievals):
                context_parts.append(f"[Document {idx+1}]: {doc}")
                doc_mapping[idx+1] = {
                    'filename': meta['filename'],
                    'source_url': meta['source_url'],
                    'content': doc
                }
            
            context_section = "Relevant Knowledge:\n\n" + "\n\n".join(context_parts) + "\n\n"

        conversation_context = ""
        if history and len(history) > 0:
            conversation_context = "Conversation History:\n\n"
            for msg in history[-3:]:  # Only last 3 messages for context
                conversation_context += f"{msg['role'].capitalize()}: {msg['message']}\n\n"

        final_prompt = (
            f"{context_section}"
            f"{conversation_context}"
            f"Question: {query}\n\n"
            f"Instructions:\n"
            f"- You are an expert AI assistant specialized in Operations Program Management at Pratt & Whitney Canada.\n"
            f"- When using information from the provided documents, cite them using ONLY simple numbers like [1], [2], [3], etc.\n"
            f"- DO NOT use subsection numbers like [1.f.i.a] or [1.ii.1] - just use [1], [2], [3]\n"
            f"- Place the citation number immediately after the relevant statement.\n"
            f"- DO NOT include a 'Sources:' section at the end of your response.\n"
            f"- Provide a clear, structured response with bullet points and headers.\n"
            f"- Use professional language appropriate for technical documentation.\n"
            f"- Always end with: 'Is there anything else you'd like help with?'\n\n"
            f"Answer:\n"
        )

        inputs = tokenizer(final_prompt, return_tensors="pt").to(config.DEVICE)
        inputs = {key: value.to(config.DEVICE) for key, value in inputs.items()}

        output = llm_model.generate(
            **inputs, 
            max_new_tokens=max_new_tokens, 
            do_sample=True, 
            temperature=temperature, 
            pad_token_id=tokenizer.eos_token_id
        )

        response_text = tokenizer.decode(output[0], skip_special_tokens=True).strip()

        if "Answer:" in response_text:
            response_text = response_text.split("Answer:")[-1].strip()
        
        # Remove any "Sources:" section if the model added it anyway
        sources_index = response_text.find("\n\nSources:")
        if sources_index != -1:
            response_text = response_text[:sources_index].strip()
        
        # Add ending question if missing
        if not response_text.endswith("Is there anything else you'd like help with?"):
            response_text += "\n\nIs there anything else you'd like help with?"
        
        # Extract citations and create citation mapping
        citation_pattern = r'\[(\d+)\]'
        citations_found = re.findall(citation_pattern, response_text)
        
        citation_info = {}
        highlighted_passages = {}
        
        # Track source usage
        source_usage = track_source_usage(response_text, meaningful_retrievals)
        
        for citation in set(citations_found):
            doc_idx = int(citation)
            if doc_idx in doc_mapping:
                doc_info = doc_mapping[doc_idx]
                citation_info[citation] = {
                    'filename': doc_info['filename'],
                    'source_url': doc_info['source_url']
                }
                
                # Find specific passages used for this citation
                highlighted_passages[citation] = []
                
                if doc_idx in source_usage:
                    for passage in source_usage[doc_idx]:
                        highlighted_passages[citation].append({
                            'filename': doc_info['filename'],
                            'source_url': doc_info['source_url'],
                            'passage': passage,
                            'passage_index': 0,
                            'full_text': doc_info['content']
                        })
                else:
                    # Fallback: Find passages that were likely used
                    citation_contexts = []
                    for match in re.finditer(rf'([^.]*\[{citation}\][^.]*\.)', response_text):
                        citation_contexts.append(match.group(1))
                    
                    for context in citation_contexts[:2]:  # Limit to 2 contexts per citation
                        clean_context = re.sub(r'\[\d+\]', '', context).strip()
                        passages = find_relevant_passages(
                            clean_context, 
                            [doc_info['content']], 
                            [{'filename': doc_info['filename'], 'source_url': doc_info['source_url']}]
                        )
                        highlighted_passages[citation].extend(passages[:1])  # One passage per context
        
        # Return enhanced response with metadata
        return {
            'response': response_text,
            'citations': citation_info,
            'highlighted_passages': highlighted_passages,
            'source_documents': doc_mapping
        }

    except Exception as e:
        logging.exception("Error generating response")
        return {
            'response': "An error occurred while generating the response.",
            'citations': {},
            'highlighted_passages': {},
            'source_documents': {}
        }

# Keep the original function for backward compatibility
def generate_response(query, history=None, max_new_tokens=1024, temperature=0.7):
    """Original function maintained for compatibility."""
    result = generate_response_with_citations(query, history, max_new_tokens, temperature)
    return result['response']
