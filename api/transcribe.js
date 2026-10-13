export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    
    try {
        // MODE 1: Text-to-Speech (Earpiece Output)
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
                    speed: 1.08
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

        // MODE 2: Speech-to-Text (Whisper)
        const base64Audio = req.body.audio;
        if (!base64Audio) {
            return res.status(400).json({ error: "No audio received" });
        }
        
        const audioBuffer = Buffer.from(base64Audio, 'base64');
        // Auto-detect WAV header ('UklGR' in base64 = 'RIFF')
        const isWav = base64Audio.startsWith('UklGR');
        const mimeType = isWav ? 'audio/wav' : 'audio/mp4';
        const fileName = isWav ? 'audio.wav' : 'audio.mp4';

        const audioBlob = new Blob([audioBuffer], { type: mimeType });
        
        const formData = new FormData();
        formData.append('file', audioBlob, fileName);
        formData.append('model', 'whisper-1');
        formData.append('language', 'en');
        formData.append('temperature', '0');
        formData.append('prompt', 'Singapore and Malaysia English ACAAN trick. Ace, 2, two, 3, three, 4, four, 5, five, 6, six, 7, seven, 8, eight, 9, nine, 10, ten, Jack, Queen, King of Clubs, Clovers, Flowers, Hearts, Spades, Diamonds. Position number 1 to 52.');
        
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
