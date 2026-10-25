const stack = [
    "4 of clubs", "2 of hearts", "7 of diamonds", "3 of clubs", "4 of hearts", "6 of diamonds", "ace of spades", "5 of hearts", "9 of spades", "2 of spades",
    "queen of hearts", "3 of diamonds", "queen of clubs", "8 of hearts", "6 of spades", "5 of spades", "9 of hearts", "king of clubs", "2 of diamonds", "jack of hearts",
    "3 of spades", "8 of spades", "6 of hearts", "10 of clubs", "5 of diamonds", "king of diamonds", "2 of clubs", "3 of hearts", "8 of diamonds", "5 of clubs",
    "king of spades", "jack of diamonds", "8 of clubs", "10 of spades", "king of hearts", "jack of clubs", "7 of spades", "10 of hearts", "ace of diamonds", "4 of spades",
    "7 of hearts", "4 of diamonds", "ace of clubs", "9 of clubs", "jack of spades", "queen of diamonds", "7 of clubs", "queen of spades", "10 of diamonds", "6 of clubs",
    "ace of hearts", "9 of diamonds"
];

function extractElements(rawText) {
    const cleanRaw = (rawText || "").trim();
    if (
        cleanRaw.length < 1 ||
        /^(you|thank you|thanks|bye|okay|oh|uh|um)$/i.test(cleanRaw) ||
        /thank you for|watching|joining|subtitles|amara\.org/i.test(cleanRaw)
    ) {
        return { card: null, position: null, partialCardAttempt: false };
    }

    let text = cleanRaw.toLowerCase().replace(/[.,!?-]/g, ' ').replace(/\s+/g, ' ').trim();

    const wordToNum = {
        'one': '1', 'two': '2', 'to': '2', 'too': '2', 'three': '3', 'tree': '3',
        'four': '4', 'for': '4', 'ford': '4', 'five': '5', 'six': '6', 'seven': '7',
        'eight': '8', 'ate': '8', 'nine': '9', 'ten': '10',
        'eleven': '11', 'twelve': '12', 'thirteen': '13', 'fourteen': '14', 'fifteen': '15',
        'sixteen': '16', 'seventeen': '17', 'eighteen': '18', 'nineteen': '19', 'twenty': '20',
        'thirty': '30', 'forty': '40', 'fifty': '50'
    };

    for (const [w, n] of Object.entries(wordToNum)) {
        text = text.replace(new RegExp(`\\b${w}\\b`, 'g'), n);
    }
    text = text.replace(/\b(20|30|40|50)\s+([1-9])\b/g, (m, tens, ones) => String(parseInt(tens) + parseInt(ones)));
    text = text.replace(/\b1\s+(?:2|to)\s+52\b/g, ' ').replace(/\b52\s+cards?\b/g, ' ');

    const hasSuitKeyword = /\b(clubs?|clovers?|flowers?|hearts?|spades?|diamonds?)\b/.test(text);
    const hasFaceKeyword = /\b(ace|jack|queen|king)\b/.test(text);

    let detectedCard = null;
    let remainingText = text;

    if (hasSuitKeyword) {
        const pairedCardRegex = /\b(ace|jack|queen|king|10|[2-9])(?:\s+(?:of|in|on|at|4|2))?\s+(clubs?|clovers?|flowers?|hearts?|spades?|diamonds?)\b/;
        const pairedMatch = text.match(pairedCardRegex);

        let value = null;
        let rawSuit = null;

        if (pairedMatch) {
            value = pairedMatch[1];
            rawSuit = pairedMatch[2];
            remainingText = text.replace(pairedMatch[0], ' ');
        } else {
            const suitMatch = text.match(/\b(clubs?|clovers?|flowers?|hearts?|spades?|diamonds?)\b/);
            const valueMatch = text.match(/\b(ace|jack|queen|king|10|[2-9])\b/);
            if (suitMatch && valueMatch) {
                value = valueMatch[1];
                rawSuit = suitMatch[1];
                remainingText = text.replace(valueMatch[0], ' ').replace(suitMatch[0], ' ');
            }
        }

        if (value && rawSuit) {
            let suit = rawSuit;
            if (suit.startsWith('club') || suit.startsWith('clover') || suit.startsWith('flower')) suit = 'clubs';
            else if (suit.startsWith('heart')) suit = 'hearts';
            else if (suit.startsWith('spade')) suit = 'spades';
            else if (suit.startsWith('diamond')) suit = 'diamonds';

            const candidate = `${value} of ${suit}`;
            if (stack.indexOf(candidate) !== -1) {
                detectedCard = candidate;
            }
        }
    }

    const numbersFound = remainingText.match(/\b([1-9]|[1-4][0-9]|5[0-2])\b/g);
    const detectedPosition = (numbersFound && numbersFound.length > 0)
        ? parseInt(numbersFound[numbersFound.length - 1], 10)
        : null;

    return {
        card: detectedCard,
        position: detectedPosition,
        partialCardAttempt: (hasSuitKeyword || hasFaceKeyword) && !detectedCard
    };
}

async function generateTTSBase64(text) {
    const ttsResponse = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'tts-1',
            input: text,
            voice: 'onyx',
            response_format: 'mp3',
            speed: 1.22
        })
    });
    if (!ttsResponse.ok) return null;
    const arrayBuffer = await ttsResponse.arrayBuffer();
    return Buffer.from(arrayBuffer).toString('base64');
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    
    try {
        // 1. Instant Keep-Warm Ping (Prevents Vercel cold starts in pocket)
        if (req.body.action === 'ping') {
            return res.status(200).json({ ok: true });
        }

        // 2. Parallel Batch Preload for All Pocket Voice Alerts
        if (req.body.action === 'init_alerts') {
            const [ready, repeat, number, card] = await Promise.all([
                generateTTSBase64("Ready."),
                generateTTSBase64("Repeat."),
                generateTTSBase64("Number."),
                generateTTSBase64("Card.")
            ]);
            return res.status(200).json({ ready, repeat, number, card });
        }

        // 3. Single TTS Fallback
        if (req.body.action === 'tts') {
            const base64Audio = await generateTTSBase64(req.body.text);
            if (!base64Audio) return res.status(500).json({ error: "TTS failed" });
            return res.status(200).json({ audio: base64Audio });
        }

        // 4. Ultra-Fast Speech-to-Text + Single-Trip Cut Calculation
        const base64Audio = req.body.audio;
        if (!base64Audio) {
            return res.status(400).json({ error: "No audio received" });
        }
        
        const audioBuffer = Buffer.from(base64Audio, 'base64');
        const isWav = base64Audio.startsWith('UklGR');
        const audioBlob = new Blob([audioBuffer], { type: isWav ? 'audio/wav' : 'audio/mp4' });
        
        const formData = new FormData();
        formData.append('file', audioBlob, isWav ? 'audio.wav' : 'audio.mp4');
        formData.append('model', 'whisper-1');
        formData.append('language', 'en');
        formData.append('temperature', '0');
        // Concise prompt for faster token decoding
        formData.append('prompt', 'Ace, 2, 3, 4, 5, 6, 7, 8, 9, 10, Jack, Queen, King of Clubs, Clovers, Flowers, Hearts, Spades, Diamonds. 1 to 52.');
        
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

        const rawText = data.text || "";
        const { card, position, partialCardAttempt } = extractElements(rawText);

        const finalCard = card || req.body.pendingCard || null;
        const finalPosition = position || req.body.pendingPosition || null;

        if (finalCard && finalPosition) {
            const cardIndex = stack.indexOf(finalCard);
            const currentPosition = cardIndex + 1;
            const formattedHeardCard = finalCard.replace(/\b\w/g, c => c.toUpperCase());

            let cutAmount = currentPosition - finalPosition;
            if (cutAmount < 0) cutAmount += 52;

            let spokenText = "";
            let resultText = "";
            if (cutAmount === 0) {
                spokenText = `${formattedHeardCard}, ${finalPosition}. Cut zero.`;
                resultText = `Cut 0 (${formattedHeardCard})`;
            } else {
                const bottomCardIndex = (cutAmount - 1 + 52) % 52;
                const bottomCard = stack[bottomCardIndex];
                const formattedBottom = bottomCard.replace(/\b\w/g, c => c.toUpperCase());
                spokenText = `${formattedHeardCard}, ${finalPosition}. Cut ${cutAmount}, ${formattedBottom}.`;
                resultText = `Cut ${cutAmount} (${formattedBottom})`;
            }

            const ttsAudio = await generateTTSBase64(spokenText);

            return res.status(200).json({
                text: rawText,
                resolved: true,
                debugText: `${formattedHeardCard} at ${finalPosition}`,
                resultText,
                audio: ttsAudio
            });
        }

        return res.status(200).json({
            text: rawText,
            resolved: false,
            card,
            position,
            partialCardAttempt
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
