import os
import torch

MODEL_PATH = "./models/Mistral-7B-Instruct-v0.2"
EXPANSION_MODEL_PATH = "./models/flan-t5-small"
EMBEDDING_MODEL_PATH = "./models/all-MiniLM-L6-v2"
ENTROPY_MODEL_PATH = "./models/ms-marco-MiniLM-L6-en"
TXT_DIRECTORY = "./data"
SOURCE_LINK_FILE = "./data/SourceLinks.xlsx"
TXT_METADATA_PATH = os.path.join(TXT_DIRECTORY, "txt_metadata.csv")
METADATA_PATH = "./metadata.csv"
FAISS_INDEX_PATH = "./faiss_index"
# T5_MODEL_PATH = "./models/t5_paraphraser"
# QA_MODEL_PATH = "./models/t5-base-e2e-qg"

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

os.environ["HF_DATASETS_OFFLINE"] = "1"
os.environ["HF_HUB_OFFLINE"] = "1"
