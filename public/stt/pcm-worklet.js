// AudioWorkletProcessor: downsample del mic al sample rate target y emite
// Int16 PCM crudo al main thread vía MessagePort. Reemplaza el pipeline
// MediaRecorder + WebM/Opus container muxing (que agrega ~100-300ms de
// buffering interno entre el speech y la entrega del chunk) por uno directo
// browser → WS → Deepgram con `encoding=linear16&sample_rate=16000`.
//
// El AudioContext puede tener sampleRate distinto al que pedimos (Chrome
// frecuentemente entrega 48000 aunque el `getUserMedia` constraint pida
// 16000; el constraint es un hint, no hard). Calculamos el ratio al primer
// process y aplicamos decimation con average simple por bloque. El mic ya
// tiene anti-alias filter del lado del browser/OS, así que aliasing de
// banda alta no es un problema en speech 0-8kHz.
//
// Int16 = formato de muestra que Deepgram acepta en linear16. PostMessage
// usa transferable ArrayBuffer (zero-copy) para no clonar el buffer.

const TARGET_SAMPLE_RATE = 16000;

class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._ratio = 0;
  }

  process(inputs, outputs) {
    // Output silence en cualquier caso. Necesario porque Chrome/Firefox a
    // veces optimizan-away nodes que no tienen output path activo, dejando
    // process() sin llamar. Conectar el node downstream a un GainNode(0) →
    // destination con esta salida silenciosa mantiene el grafo activo sin
    // generar audio audible.
    const output = outputs[0];
    if (output) {
      for (let ch = 0; ch < output.length; ch++) {
        output[ch].fill(0);
      }
    }

    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const channel = input[0];
    if (!channel || channel.length === 0) return true;

    if (this._ratio === 0) {
      // sampleRate es una variable global del AudioWorkletGlobalScope.
      this._ratio = sampleRate / TARGET_SAMPLE_RATE;
    }
    const ratio = this._ratio;

    // Frame común: 128 samples a 48kHz → 42 samples a 16kHz. Si ratio === 1
    // (AudioContext respetó nuestro 16k), copy directo.
    const outLen = Math.max(1, Math.floor(channel.length / ratio));
    const out = new Int16Array(outLen);

    if (ratio === 1) {
      for (let i = 0; i < outLen; i++) {
        const s = channel[i];
        out[i] = Math.max(-32768, Math.min(32767, Math.round(s * 32767)));
      }
    } else {
      // Decimation por average: simple, suficiente para speech post anti-alias.
      for (let i = 0; i < outLen; i++) {
        const start = Math.floor(i * ratio);
        const end = Math.min(channel.length, Math.floor((i + 1) * ratio));
        let sum = 0;
        let count = 0;
        for (let j = start; j < end; j++) {
          sum += channel[j];
          count += 1;
        }
        const avg = count > 0 ? sum / count : 0;
        out[i] = Math.max(-32768, Math.min(32767, Math.round(avg * 32767)));
      }
    }

    // Transferable: el main thread recibe el ArrayBuffer sin copia.
    this.port.postMessage(out.buffer, [out.buffer]);
    return true;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
