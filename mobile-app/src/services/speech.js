export class SpeechService {
  constructor() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = SpeechRecognition ? new SpeechRecognition() : null;
    this.isRecording = false;
    
    if (this.recognition) {
      // Set properties for real-time dictation
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'ru-RU';
    }
  }

  isSupported() {
    return !!this.recognition;
  }

  start({ onResult, onInterim, onError, onEnd }) {
    if (!this.recognition || this.isRecording) return;
    this.isRecording = true;
    
    let finalTranscript = '';

    this.recognition.onresult = (event) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      
      const fullText = (finalTranscript + interimTranscript).trim();
      if (onInterim) {
        onInterim(fullText);
      }
    };

    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (onError) {
        let errorMsg = 'Ошибка записи голоса.';
        if (event.error === 'not-allowed') {
          errorMsg = 'Нет разрешения на использование микрофона.';
        } else if (event.error === 'no-speech') {
          errorMsg = 'Речь не обнаружена.';
        }
        onError(errorMsg);
      }
    };

    this.recognition.onend = () => {
      this.isRecording = false;
      if (onEnd) onEnd(finalTranscript.trim());
    };

    try {
      this.recognition.start();
    } catch (e) {
      console.error('Failed to start speech recognition:', e);
      this.isRecording = false;
      if (onError) onError('Не удалось запустить диктофон.');
    }
  }

  stop() {
    if (!this.recognition || !this.isRecording) return;
    try {
      this.recognition.stop();
    } catch (e) {
      console.error('Failed to stop speech recognition:', e);
    }
    this.isRecording = false;
  }
}

export const speechService = new SpeechService();
