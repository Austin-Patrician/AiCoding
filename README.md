# FastAPI Project

This is a basic FastAPI project structure.

## Setup

1.  Create a virtual environment:
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    ```

2.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```

## Run

Run the application with uvicorn:

```bash
uvicorn app.main:app --reload
```

The API will be available at `http://127.0.0.1:8000`.
The interactive API documentation will be available at `http://127.0.0.1:8000/docs`.
