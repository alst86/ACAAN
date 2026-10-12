export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    
    try {
        const base64Audio = req.body.audio;
        if (!base64Audio) {
            return res.status(400).json({ error: "No audio received from phone" });
        }
        
        // Convert the Base64 text string back into a raw audio file for OpenAI
        const audioBuffer = Buffer.from(base64Audio, 'base64');
        const audioBlob = new Blob([audioBuffer], { type: 'audio/mp4' });
        
        const formData = new FormData();
        formData.append('file', audioBlob, 'audio.mp4');
        formData.append('model', 'whisper-1');
        formData.append('language', 'en'); // Force English processing 
        
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
