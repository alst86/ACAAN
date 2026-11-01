const stack = [
    "4 of clubs", "2 of hearts", "7 of diamonds", "3 of clubs", "4 of hearts", "6 of diamonds", "ace of spades", "5 of hearts", "9 of spades", "2 of spades",
    "queen of hearts", "3 of diamonds", "queen of clubs", "8 of hearts", "6 of spades", "5 of spades", "9 of hearts", "king of clubs", "2 of diamonds", "jack of hearts",
    "3 of spades", "8 of spades", "6 of hearts", "10 of clubs", "5 of diamonds", "king of diamonds", "2 of clubs", "3 of hearts", "8 of diamonds", "5 of clubs",
    "king of spades", "jack of diamonds", "8 of clubs", "10 of spades", "king of hearts", "jack of clubs", "7 of spades", "10 of hearts", "ace of diamonds", "4 of spades",
    "7 of hearts", "4 of diamonds", "ace of clubs", "9 of clubs", "jack of spades", "queen of diamonds", "7 of clubs", "queen of spades", "10 of diamonds", "6 of clubs",
    "ace of hearts", "9 of diamonds"
];

function extractElementsRegex(rawText) {
    const cleanRaw = (rawText || "").trim();
    if (
        cleanRaw.length < 1 ||
        /^(you|thank you|thanks|bye|okay|oh|uh|um)$/i.test(cleanRaw) ||
        /thank you for|watching|joining|subtitles|amara\.org/i.test(cleanRaw)
    ) {
        return { card: null, position: null, partialCardAttempt: false, isNoise: true };
    }

    let text = cleanRaw.toLowerCase().replace(/[.,!?-]/g, ' ').replace(/\s+/g, ' ').trim();

    // Normalize common SG/MY phonetic variations & ordinals
    const wordToNum = {
        'first': '1', 'second': '2', 'third': '3', 'fourth': '4', 'fifth': '5',
        'sixth': '6', 'seventh': '7', 'eighth': '8', 'ninth': '9', 'tenth': '10',
        'one': '1', 'won': '1', 'two': '2', 'to': '2', 'too': '2', 'tu': '2',
        'three': '3', 'tree': '3', 'free': '3', 'four': '4', 'for': '4', 'fore': '4', 'ford': '4',
        'five': '5', 'fife': '5', 'six': '6', 'sex': '6', 'seven': '7',
        'eight': '8', 'ate': '8', 'nine': '9', 'night': '9', 'ten': '10', 'tin': '10',
        'eleven': '11', 'twelve': '12', 'thirteen': '13', 'fourteen': '14', 'fifteen': '15',
        'sixteen': '16', 'seventeen': '17', 'eighteen': '18', 'nineteen': '19',
        'twenty': '20', 'thirty': '30', 'dirty': '30', 'forty': '40', 'fourty': '40', 'fifty': '50'
    };

    for (const [w, n] of Object.entries(wordToNum)) {
        text = text.replace(new RegExp(`\\b${w}\\b`, 'g'), n);
    }

    // Strip ordinal suffixes from digits (e.g. "21st" -> "21", "36th" -> "36")
    text = text.replace(/\b(\d+)(?:st|nd|rd|th)\b/g, '$1');

    // Combine compound numbers ("20 5" -> "25")
    text = text.replace(/\b(20|30|40|50)\s+([1-9])\b/g, (m, tens, ones) => String(parseInt(tens, 10) + parseInt(ones, 10)));

    // Strip magician patter phrases ("1 to 52", "52 cards")
    text = text.replace(/\b1\s+(?:2|to|until|through)\s+52\b/g, ' ')
               .replace(/\b52\s+cards?\b/g, ' ');

    // Normalize phonetic suit & face mishearings
    text = text
        .replace(/\b(clovers?|flowers?|claps?|klubs?|cups?|pupp(?:y|ies))\b/g, 'clubs')
        .replace(/\b(harts?|hards?|hurts?|arts?)\b/g, 'hearts')
        .replace(/\b(space|speeds?|speaks?|states?|paid|spits?)\b/g, 'spades')
        .replace(/\b(dimonds?|daimonds?|demons?)\b/g, 'diamonds')
        .replace(/\b(ays|is|his|eight\s+of\s+spades)\b/g, (m) => m.startsWith('eight') ? m : 'ace')
        .replace(/\b(jacks?|check|jak)\b/g, 'jack')
        .replace(/\b(queens?|quin|clean|green)\b/g, 'queen')
        .replace(/\b(kings?|kin)\b/g, 'king');

    const suitRegex = /\b(clubs?|hearts?|spades?|diamonds?)\b/;
    const hasSuitKeyword = suitRegex.test(text);
    const hasFaceKeyword = /\b(ace|jack|queen|king)\b/.test(text);

    let detectedCard = null;
    let remainingText = text;

    if (hasSuitKeyword) {
        // 1. Look for Value + Suit paired together ("10 of spades", "queen spades", "4 clubs")
        const pairedCardRegex = /\b(ace|1|jack|queen|king|10|[2-9])(?:\s+(?:of|in|on|at|a|the|4|2))?\s+(clubs?|hearts?|spades?|diamonds?)\b/;
        const pairedMatch = text.match(pairedCardRegex);

        let value = null;
        let rawSuit = null;

        if (pairedMatch) {
            value = pairedMatch[1] === '1' ? 'ace' : pairedMatch[1];
            rawSuit = pairedMatch[2];
            remainingText = text.replace(pairedMatch[0], ' ');
        } else {
            // 2. Look for reversed Suit + Value ("spades 10", "clubs queen")
            const reverseCardRegex = /\b(clubs?|hearts?|spades?|diamonds?)\s+(?:of\s+)?(ace|1|jack|queen|king|10|[2-9])\b/;
            const reverseMatch = text.match(reverseCardRegex);
            if (reverseMatch) {
                rawSuit = reverseMatch[1];
                value = reverseMatch[2] === '1' ? 'ace' : reverseMatch[2];
                remainingText = text.replace(reverseMatch[0], ' ');
            } else {
                const suitMatch = text.match(suitRegex);
                const valueMatch = text.match(/\b(ace|1|jack|queen|king|10|[2-9])\b/);
                if (suitMatch && valueMatch) {
                    value = valueMatch[1] === '1' ? 'ace' : valueMatch[1];
                    rawSuit = suitMatch[1];
                    remainingText = text.replace(valueMatch[0], ' ').replace(suitMatch[0], ' ');
                }
            }
        }

        if (value && rawSuit) {
            let suit = rawSuit;
            if (suit.startsWith('club')) suit = 'clubs';
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
        partialCardAttempt: (hasSuitKeyword || hasFaceKeyword) && !detectedCard,
        isNoise: false
    };
}

// Layer 2: Fast GPT-4o-mini semantic rescue if noisy room garbled the Whisper transcript
async function extractElementsWithLLM(rawText, pendingCard, pendingPosition) {
    try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                temperature: 0,
                max_tokens: 60,
                response_format: { type: 'json_object' },
                messages: [
                    {
                        role: 'system',
                        content: `You extract a playing card and a stack position number (1 to 52) from noisy speech transcriptions in Singapore/Malaysia English.
Valid card format: "<value> of <suit>" in lowercase, where <value> is ace, 2, 3, 4, 5, 6, 7, 8, 9, 10, jack, queen, king and <suit> is clubs, hearts, spades, diamonds.
Note phonetic sound-alikes: "clovers"/"flowers"/"claps" = clubs, "space"/"speeds" = spades, "harts"/"hard" = hearts, "for" = 4, "tree" = 3, "ate" = 8, "dirty" = 30.
Ignore magician patter like "1 to 52" or "52 cards".
Return ONLY JSON: {"card": "queen of clubs" or null, "position": 45 or null, "partialCardAttempt": true/false}`
                    },
                    {
                        role: 'user',
                        content: `Transcript: "${rawText}" (Previously locked card: ${pendingCard || 'none'}, locked position: ${pendingPosition || 'none'})`
                    }
                ]
            })
        });
        if (!res.ok) return null;
        const data = await res.json();
        const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
        const validCard = (parsed.card && stack.includes(parsed.card.toLowerCase())) ? parsed.card.toLowerCase() : null;
        const validPos = (Number.isInteger(parsed.position) && parsed.position >= 1 && parsed.position <= 52) ? parsed.position : null;
        return {
            card: validCard,
            position: validPos,
            partialCardAttempt: Boolean(parsed.partialCardAttempt) && !validCard
        };
    } catch (e) {
        return null;
    }
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
            speed: 1.2
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
        if (req.body.action === 'ping') {
            return res.status(200).json({ ok: true });
        }

        if (req.body.action === 'init_alerts') {
            const [ready, repeat, number, card] = await Promise.all([
                generateTTSBase64("Ready."),
                generateTTSBase64("Repeat."),
                generateTTSBase64("Number."),
                generateTTSBase64("Card.")
            ]);
            return res.status(200).json({ ready, repeat, number, card });
        }

        if (req.body.action === 'tts') {
            const base64Audio = await generateTTSBase64(req.body.text);
            if (!base64Audio) return res.status(500).json({ error: "TTS failed" });
            return res.status(200).json({ audio: base64Audio });
        }

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
        formData.append('prompt', 'Singapore and Malaysia English card magic trick. Ace, two, three, four, five, six, seven, eight, nine, ten, Jack, Queen, King of Clubs, Clovers, Flowers, Hearts, Spades, Diamonds. Position number 1 to 52.');
        
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

        const rawText = (data.text || "").trim();
        const combinedText = req.body.previousTranscript
            ? `${req.body.previousTranscript} ${rawText}`.trim()
            : rawText;

        // 1. Run instant Regex + Phonetic parser first
        let { card, position, partialCardAttempt, isNoise } = extractElementsRegex(rawText);

        // 2. If incomplete on single breath, check combined rolling transcript
        if ((!card || !position) && req.body.previousTranscript && !isNoise) {
            const combo = extractElementsRegex(combinedText);
            if (!card && combo.card) card = combo.card;
            if (!position && combo.position) position = combo.position;
        }

        // 3. If still incomplete and real speech was heard, run GPT-4o-mini smart rescue
        const tentativeCard = card || req.body.pendingCard || null;
        const tentativePos = position || req.body.pendingPosition || null;

        if ((!tentativeCard || !tentativePos) && !isNoise && rawText.length > 2) {
            const llmResult = await extractElementsWithLLM(combinedText, req.body.pendingCard, req.body.pendingPosition);
            if (llmResult) {
                if (!card && llmResult.card) card = llmResult.card;
                if (!position && llmResult.position) position = llmResult.position;
                if (llmResult.partialCardAttempt) partialCardAttempt = true;
            }
        }

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
