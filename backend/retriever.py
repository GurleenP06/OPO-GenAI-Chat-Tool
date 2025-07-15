import faiss
import numpy as np
import pandas as pd
from sentence_transformers import SentenceTransformer, CrossEncoder
import config
import bm25s
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM, pipeline
import ast

llm_tokenizer = AutoTokenizer.from_pretrained(config.EXPANSION_MODEL_PATH, local_files_only=True)
llm_model = AutoModelForSeq2SeqLM.from_pretrained(config.EXPANSION_MODEL_PATH, local_files_only=True)
llm_generator = pipeline("text2text-generation", model=llm_model, tokenizer=llm_tokenizer)

model = SentenceTransformer(config.EMBEDDING_MODEL_PATH, device=config.DEVICE)
reranker = CrossEncoder(config.ENTROPY_MODEL_PATH, device=config.DEVICE)

def bm25_search(query, metadata_df, top_k=10):
    corpus = metadata_df['chunk_text'].tolist()
    tokenized_corpus = bm25s.tokenize(corpus, stopwords="en")
    
    retriever = bm25s.BM25()
    retriever.index(tokenized_corpus)
    
    tokenized_query = bm25s.tokenize(query, stopwords="en")
    results, scores = retriever.retrieve(tokenized_query, k=top_k, corpus=corpus)
    
    result_docs = []
    for i in range(results.shape[1]):
        result_docs.append({
            "chunk_text": results[0, i],
            "bm25_score": scores[0, i]
        })
    result_df = pd.DataFrame(result_docs)
    
    merged_df = pd.merge(metadata_df, result_df, on="chunk_text", how="inner")
    merged_df = merged_df.sort_values(by="bm25_score", ascending=False).head(top_k)
    return merged_df

def hybrid_retrieve(query, top_k_semantic=10, top_k_keyword=10, final_top_k=3):
    query_embedding = model.encode([query])[0]
    index = faiss.read_index(config.FAISS_INDEX_PATH)
    _, indices = index.search(np.array([query_embedding]), top_k_semantic)
    
    semantic_metadata = pd.read_csv(config.METADATA_PATH)
    semantic_candidates = semantic_metadata.iloc[indices[0]].copy()
    
    bm25_candidates = bm25_search(query, pd.read_csv(config.METADATA_PATH), top_k=top_k_keyword)
    
    combined = pd.concat([semantic_candidates, bm25_candidates]).drop_duplicates(subset=['chunk_text'])
    combined_candidates = combined.to_dict(orient='records')
    
    query_passage_pairs = [(query, rec['chunk_text']) for rec in combined_candidates]
    scores = reranker.predict(query_passage_pairs)
    sorted_indices = np.argsort(scores)[::-1]
    
    final_texts = [combined_candidates[i]['chunk_text'] for i in sorted_indices[:final_top_k]]
    final_metadata = [{
        "filename": combined_candidates[i].get('original_filename', combined_candidates[i].get('filename', '')),
        "source_url": combined_candidates[i]['source_url']
    } for i in sorted_indices[:final_top_k]]
    
    return final_texts, final_metadata

def expand_query(query):
    prompt = f"""
You are an expert in information retrieval and processing user queries. Your task is to expand a given query into a list of queries that are semantically similar or contextually relevant to the original query. This expansion should help in retrieving a broader range of results that are still closely related with the original query.

Instructions:
- Generate expanded queries: For each input query, generate a list of at least 3 alternative queries that capture the same or similar meaning as the original input query.
- Semantic consistency - Ensure that the expanded queries remain semantically consistent with the original query, capturing various ways users might search for the same information.
- Contextual relevance: Incorporate different aspects or related terms that could yield helpful search results, while maintaining the core idea of the original query.
- Diversity: Aim to cover different synonyms, related concepts, and potential angles of the query to maximize the relevance of the search results.

Examples:

Original Query 1: "climate change effects"
Expanded Queries: ["impact of climate change", "consequences of global warming", "effects of environmental damage"]

Original Query 2: "machine learning algorithms"
Expanded Queries: ["neural networks", "supervised learning", "deep learning"]

Output structure:
["expanded query 1", "expanded query 2", "expanded query 3"]

Original Query: "{query}"
Expanded Queries:"""

    generated = llm_generator(prompt, max_new_tokens=64, num_return_sequences=1)[0]['generated_text']
    
    try:
        output = generated.split("Expanded Queries:")[-1].strip()
        expanded_queries = ast.literal_eval(output)
        if isinstance(expanded_queries, list):
            return expanded_queries
    except Exception:
        return [
            query,
            query + " alternative perspective",
            query + " in detail",
            query + " explained"
        ]

def retrieve_knowledge(query, top_k=10):
    expanded_queries = expand_query(query)
    all_candidates = []
    
    for q in expanded_queries:
        texts, metadata = hybrid_retrieve(q, top_k_semantic=top_k, top_k_keyword=top_k, final_top_k=3)
        for t, m in zip(texts, metadata):
            all_candidates.append((t, m))
    
    seen = set()
    unique_candidates = []
    for text, meta in all_candidates:
        if text not in seen:
            unique_candidates.append((text, meta))
            seen.add(text)
    
    return unique_candidates