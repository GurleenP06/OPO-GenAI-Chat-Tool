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
        end_pos = start_pos + len(chunk)
        chunks.append((chunk, start_pos, end_pos))
    
    return chunks

def find_relevant_passages(response_sentence: str, retrieved_docs: List[str], 
                          retrieved_metadata: List[Dict], threshold: float = 0.5) -> List[Dict]:
    """Find which retrieved passages are relevant to a response sentence."""
    relevant_passages = []
    
    # Simple keyword matching - in production, you'd use semantic similarity
    response_keywords = set(response_sentence.lower().split())
    
    for doc, meta in zip(retrieved_docs, retrieved_metadata):
        doc_keywords = set(doc.lower().split())
        overlap = len(response_keywords.intersection(doc_keywords))
        
        if overlap > len(response_keywords) * threshold:
            # Find the specific passage in the document
            doc_sentences = re.split(r'(?<=[.!?])\s+', doc)
            for idx, sent in enumerate(doc_sentences):
                sent_keywords = set(sent.lower().split())
                if len(response_keywords.intersection(sent_keywords)) > 2:
                    relevant_passages.append({
                        'filename': meta['filename'],
                        'source_url': meta['source_url'],
                        'passage': sent,
                        'passage_index': idx,
                        'full_text': doc
                    })
                    break
    
    return relevant_passages

def generate_response_with_citations(query, history=None, max_new_tokens=1024, temperature=0.7):
    """Generate response with inline citations and passage highlighting info."""
    try:
        candidates = retrieve_knowledge(query, top_k=10)
        retrieved_docs = [doc for doc, meta in candidates]
        retrieved_metadata = [meta for doc, meta in candidates]
        
        meaningful_retrievals = [doc.strip() for doc in retrieved_docs if len(doc.strip()) > 100]
        meaningful_metadata = [meta for doc, meta in zip(retrieved_docs, retrieved_metadata) if len(doc.strip()) > 100]

        # Create context with document indices
        context_section = ""
        doc_mapping = {}  # Maps doc index to metadata
        
        if meaningful_retrievals:
            context_parts = []
            for idx, (doc, meta) in enumerate(zip(meaningful_retrievals, meaningful_metadata)):
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
        
        for citation in set(citations_found):
            doc_idx = int(citation)
            if doc_idx in doc_mapping:
                doc_info = doc_mapping[doc_idx]
                citation_info[citation] = {
                    'filename': doc_info['filename'],
                    'source_url': doc_info['source_url']
                }
                
                # Find passages that were likely used for this citation
                citation_contexts = []
                for match in re.finditer(rf'([^.]*\[{citation}\][^.]*\.)', response_text):
                    citation_contexts.append(match.group(1))
                
                # Find matching passages in the source document
                highlighted_passages[citation] = []
                for context in citation_contexts:
                    clean_context = re.sub(r'\[\d+\]', '', context).strip()
                    passages = find_relevant_passages(
                        clean_context, 
                        [doc_info['content']], 
                        [{'filename': doc_info['filename'], 'source_url': doc_info['source_url']}]
                    )
                    highlighted_passages[citation].extend(passages)
        
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