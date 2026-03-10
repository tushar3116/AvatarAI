# AI Avatar Platform - Project Documentation

## 1. Technologies Used

**Frontend Ecosystem:**

- **React 19**: The core library for building the user interface.
- **Vite 7**: A fast build tool and development server.
- **Tailwind CSS 4**: A utility-first CSS framework for styling components.
- **WebSockets**: Used for real-time bidirectional communication with the backend.
- **Web Audio API**: Used to capture microphone audio and analyze audio levels to power the avatar animations.
- **Canvas API**: Used to render complex, high-performance animations (Avatar idling, Avatar speaking wave, and audio recording wave).

**Backend Ecosystem:**

- **Python 3.10+**: The programming language for the server.
- **FastAPI**: A modern, high-performance web framework for building REST and WebSocket APIs in Python.
- **Uvicorn**: An ASGI web server implementation for Python to run FastAPI.
- **LangChain**: A framework for developing applications powered by language models (used here for the RAG agent).
- **ChromaDB**: An open-source vector database for storing and retrieving document embeddings.
- **OpenAI (Whisper API & GPT-4o)**: Used for Speech-To-Text (Whisper) and as the core brain of the Avatar (GPT-4o via LangChain).
- **ElevenLabs**: Used for high-quality Text-To-Speech (TTS) voice generation.

---

## 2. Dependencies and their Use Cases

### Frontend (`package.json`)

- **`react` & `react-dom`**: Building and rendering the component tree in the browser.
- **`vite`**: Building the project and serving it fast during development.
- **`tailwindcss` & `@tailwindcss/vite`**: For styling the application efficiently using utility classes.
- **`lucide-react`**: A library of beautiful, customizable SVG icons (used for UI elements like mic, upload, checkmarks, user/bot icons).
- **`eslint` & `globals` & plugins**: For linting the codebase to ensure code quality and catch errors early.

### Backend (`requirements.txt`)

- **`fastapi`**: Used to define the REST endpoints (`/api/v1/ingest`, `/api/v1/collections`) and the WebSocket endpoint (`/api/v1/ws`).
- **`uvicorn[standard]`**: The ASGI server that actually runs the FastAPI app and handles concurrent connections.
- **`python-multipart`**: Required by FastAPI to handle form data, specifically used to parse the uploaded files (PDFs, text) in the `/api/v1/ingest` endpoint.
- **`websockets`**: Provides the underlying WebSocket protocol implementation for FastAPI's `WebSocket` class.
- **`langchain` / `langchain-openai` / `langchain-community`**: The orchestration framework used to connect the LLM with the vector database tools, so the Avatar can answer questions based on the uploaded documents.
- **`langchain-chroma` & `chromadb`**: The vector store where the uploaded documents are chunked, embedded, and saved locally to be retrieved during the conversation.
- **`openai`**: The official OpenAI SDK used directly to make calls to the Whisper API for audio transcription and optionally for TTS if ElevenLabs fails.
- **`elevenlabs`**: The official ElevenLabs SDK used to stream highly realistic generated voices for the Avatar's responses.
- **`pypdf`**: A library used by Langchain to read and extract text from uploaded PDF documents.
- **`python-dotenv` & `pydantic-settings`**: Used to load environment variables from the `.env` file and strictly type-check configuration variables (like API keys).
- **`numpy`**: A mathematical library often required as a downstream dependency for embeddings and AI operations.

---

## 3 & 4. Frontend Components: Locations and Logic

All frontend components are located inside the `frontend/src/` folder. The application is structured with a main `App.jsx` orchestrating the UI, custom hooks for complex logic, and individual UI components for isolated visual areas.

### A. Main App Component

**Location:** `frontend/src/App.jsx`
**Logic:**
This is the root component. It manages the high-level state of the application:

- **State Management**: It tracks `collections` (available knowledge bases), `selectedCollection` (the one currently active), and the open/closed state of the left and right side panels.
- **Orchestration**: It imports and initializes the custom hooks `useWebSocket` and `useAudioRecorder`.
- **Event Handling**:
  - `handleFileIngested` & `handleSelectCollection`: Triggered when a new document is uploaded or an existing collection is selected. It connects the WebSocket, passing the collection name to the server so the backend knows which context to use.
  - `handleStartRecording`: Called when the user presses the speak button. It first sends a `stop` signal to the WebSocket (to interrupt the avatar if it's currently talking) and then starts local audio recording.
  - `handleStopRecording`: Stops the local audio recording and sends the resulting audio Blob (in WebM/Opus format) to the backend via the WebSocket connection.

### B. Custom Hooks (Logic Abstraction)

#### 1. `useAudioRecorder`

**Location:** `frontend/src/hooks/useAudioRecorder.js`
**Logic:**

- Requests microphone permission using `navigator.mediaDevices.getUserMedia(..., { sampleRate: 16000 })`.
- Utilizes the **Web Audio API** (`AudioContext`, `AnalyserNode`) to measure the raw frequency data of the user's voice in real-time. This calculates an average `audioLevel` between 0 and 1, used to animate the waveform during speaking.
- It uses `MediaRecorder` to capture chunks of audio in `audio/webm;codecs=opus` format.
- When `stopRecording()` is called, it combines the chunks into a single Blob and stops all tracks to release the microphone.

#### 2. `useWebSocket`

**Location:** `frontend/src/hooks/useWebSocket.js`
**Logic:**

- Manages the entire WebSocket lifecycle (connect, disconnect, auto-reconnect).
- **Message Router:** It parses incoming JSON messages from the backend into different types of actions:
  - `transcript`: User's transcribed text. It adds this to the conversation array and sets `isProcessing` to `true`.
  - `agent_reply`: The Avatar's text response. It adds this to the conversation array.
  - `audio_response`: The Avatar's voice. It receives base64 encoded MP3 data, converts it into a `Uint8Array`, wraps it in a Blob, and creates an object URL (`URL.createObjectURL(blob)`) to be played by the `AvatarFrame`.
- Provides methods `sendAudio()` to stream raw binary audio to the server and `sendStop()` to inform the backend to interrupt its current LLM/TTS processing.

### C. UI Components

#### 1. `AvatarFrame`

**Location:** `frontend/src/components/AvatarFrame.jsx`
**Logic:**

- **Visuals**: Uses the HTML5 Canvas API in a `requestAnimationFrame` loop to draw the interactive Avatar. It renders floating ambient orbs, a central avatar circle with an outer glow, and sound-wave rings.
- **State Reactions**: The canvas animation changes dynamically based on the props passed to it (`isPlaying`, `isProcessing`). If the avatar is speaking (`isPlaying`), the rings pulse and the colors become more vibrant. If it's `isProcessing`, it shows a "Thinking" state.
- **Audio Playback**: Contains a hidden `<audio>` element tied to a `useRef`. When `useWebSocket` receives a new audio BLOB URL and passes it as `latestAudio`, this component detects the change via `useEffect`, assigns the URL to the `<audio>` source, and automatically plays the AI's voice.

#### 2. `FileUpload`

**Location:** `frontend/src/components/FileUpload.jsx`
**Logic:**

- **Drag & Drop**: Provides a drop-zone that listens to `onDrop`, `onDragOver`, and `onDragLeave` to allow users to drag documents directly into the UI.
- **File Input fallback**: Offers a hidden `<input type="file">` triggered via a click for manual file selection.
- **API Call**: When a file is selected, it creates a `FormData` object, appends the file, and sends a `POST` request using `fetch` to `/api/v1/ingest`.
- It tracks the upload progress (`uploading`, `success`, `error`) and updates the state to show visual feedback (spinners, checkmarks) in the file list. Once successful, it triggers the callback `onFileIngested` to inform the parent `App` component.

#### 3. `SpeakButton`

**Location:** `frontend/src/components/SpeakButton.jsx`
**Logic:**

- **Push-to-Talk Logic**: Uses `onMouseDown` / `onTouchStart` to begin recording and `onMouseUp` / `onMouseLeave` / `onTouchEnd` to stop recording.
- **Visual Feedback**: Analyzes the `audioLevel` prop (which is constantly updated by `useAudioRecorder` via `App.jsx`) and uses an embedded Canvas API animation to draw a dynamic vertical bar waveform. The height of the bars directly correlates to how loud the user is speaking.
- Also handles states where the system is disconnected (button disabled and greyed out) or processing (shows a shimmering line animation instead of the voice waveform).

#### 4. `Transcript`

**Location:** `frontend/src/components/Transcript.jsx`
**Logic:**

- A simple presentation component that takes an array of `messages` from the WebSocket hook and maps them into a chat-like interface.
- Includes a scroll-to-bottom logic using `useRef` directly on an empty `<div>` at the end of the list, ensuring that when new messages arrive, the view auto-scrolls down smoothly (`behavior: 'smooth'`).
- Provides logic to format timestamps and distinct styling based on `msg.role` (User vs AI Avatar), including an option to clear the history.
