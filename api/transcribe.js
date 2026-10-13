export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    
    try {
        // MODE 1: Text-to-Speech (Generate MP3 for Bluetooth earpiece)
        if (req.body.action === 'tts') {
            const ttsResponse = await fetch('https://api.openai.com/v1/audio/speech', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'tts-1',
                    input: req.body.text,
                    voice: 'onyx',
                    response_format: 'mp3',
                    speed: 1.05
                })
            });

            if (!ttsResponse.ok) {
                const err = await ttsResponse.json();
                return res.status(500).json({ error: err.error?.message || "TTS failed" });
            }

            const arrayBuffer = await ttsResponse.arrayBuffer();
            const base64Audio = Buffer.from(arrayBuffer).toString('base64');
            return res.status(200).json({ audio: base64Audio });
        }

        // MODE 2: Speech-to-Text (Whisper Transcription)
        const base64Audio = req.body.audio;
        if (!base64Audio) {
            return res.status(400).json({ error: "No audio received from phone" });
        }
        
        const audioBuffer = Buffer.from(base64Audio, 'base64');
        const audioBlob = new Blob([audioBuffer], { type: 'audio/mp4' });
        
        const formData = new FormData();
        formData.append('file', audioBlob, 'audio.mp4');
        formData.append('model', 'whisper-1');
        formData.append('language', 'en');
        // Prompt Whisper with playing card vocabulary so it doesn't hear "pool" instead of "two/four"
        formData.append('prompt', 'Ace, two, three, four, five, six, seven, eight, nine, ten, jack, queen, king of clubs, hearts, spades, diamonds, 1 to 52.');
        
        const aiResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: formData
        });
        
        const data = await aiResponse.json();
        
        if (data.error) {
            return res.status(500).json({ error: data.error.message });
        }

        return res.status(200).json({ text: data.text });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
