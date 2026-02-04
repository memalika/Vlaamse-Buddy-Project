const micBtn = document.getElementById('mic-btn');
const micContainer = document.getElementById('mic-container');
const micPulse = document.getElementById('mic-pulse');
const statusText = document.getElementById('status-text');
const subStatus = document.getElementById('sub-status');
const feedbackContainer = document.getElementById('feedback-container');

let currentScenario = "Free Talk";

// Audio Recording (Multimodal for Pronunciation Analysis)
let mediaRecorder;
let audioChunks = [];
let isListening = false;

// Check support
if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    statusText.textContent = "Geen Microfoon";
    subStatus.textContent = "Browser ondersteunt dit niet";
}

micBtn.addEventListener('click', async () => {
    if (isListening) {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
    } else {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeType = 'audio/webm';

            mediaRecorder = new MediaRecorder(stream, { mimeType });
            audioChunks = [];

            mediaRecorder.addEventListener("dataavailable", event => {
                if (event.data.size > 0) audioChunks.push(event.data);
            });

            mediaRecorder.addEventListener("stop", async () => {
                isListening = false;
                setMicState(false);
                statusText.textContent = "Analyseren...";
                subStatus.textContent = "Luisteren naar uitspraak...";

                const audioBlob = new Blob(audioChunks, { type: mimeType });
                await processAudio(audioBlob);

                stream.getTracks().forEach(track => track.stop());
            });

            mediaRecorder.start();
            isListening = true;
            setMicState(true);
            statusText.textContent = "Aan het luisteren...";
            subStatus.textContent = "Spreek nu...";

        } catch (err) {
            console.error("Mic Error:", err);
            statusText.textContent = "Geen Toegang";
            subStatus.textContent = "Check instellingen";
        }
    }
});

function setMicState(active) {
    if (active) {
        micPulse.classList.remove('hidden');
        micPulse.classList.add('animate-[ping_2.5s_cubic-bezier(0,0,0.2,1)_infinite]');
    } else {
        micPulse.classList.add('hidden');
        micPulse.classList.remove('animate-[ping_2.5s_cubic-bezier(0,0,0.2,1)_infinite]');
    }
}

async function processAudio(blob) {
    const formData = new FormData();
    formData.append("file", blob);
    formData.append("scenario", currentScenario);

    try {
        const res = await fetch('/api/analyze_audio', {
            method: 'POST',
            body: formData
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.detail || "Analyse mislukt");
        }

        const data = await res.json();

        renderFeedback(data.transcript, data);
        statusText.textContent = "Klaar!";
        subStatus.textContent = "Feedback hieronder";

        if (data.response) {
            speak(data.response);
        } else if (data.better_alternative) {
            speak(data.better_alternative);
        }

    } catch (e) {
        console.error("Analysis Error:", e);
        statusText.textContent = "Fout bij analyse";
        subStatus.textContent = e.message || "Probeer het opnieuw";

        feedbackContainer.innerHTML = `
            <div class="text-center text-red-400 mt-10">
                <span class="material-symbols-outlined text-5xl mb-3">error</span>
                <p class="font-bold">${e.message || "Er is iets misgegaan."}</p>
                <p class="text-sm opacity-70">Check je API key of probeer later opnieuw.</p>
            </div>
        `;
    }
}

function renderFeedback(userText, data) {
    feedbackContainer.innerHTML = '';

    // Header with Verified Badge
    const headerHtml = `
    <div class="flex items-center justify-between mb-6">
        <h3 class="text-slate-900 text-xl font-bold tracking-tight">Analyse & Feedback</h3>
        <div class="flex items-center gap-1.5 px-3 py-1 bg-primary/20 rounded-full border border-primary/30">
            <span class="material-symbols-outlined text-green-700" style="font-size: 16px;">verified</span>
            <span class="text-xs font-bold text-green-800">Voltooid</span>
        </div>
    </div>`;
    feedbackContainer.insertAdjacentHTML('beforeend', headerHtml);

    // 1. Pronunciation Card
    const score = data.pronunciation_score || 0;
    const pronHtml = `
    <div class="group bg-white rounded-xl p-5 mb-4 border-4 border-dashed border-teal-200 shadow-sm hover:border-teal-300 transition-colors">
        <div class="flex justify-between items-start mb-4">
            <div class="flex items-center gap-3">
                <div class="size-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
                    <span class="material-symbols-outlined">graphic_eq</span>
                </div>
                <h4 class="font-bold text-lg text-slate-900">Uitspraak</h4>
            </div>
            <div class="flex flex-col items-end">
                <span class="text-2xl font-bold text-slate-900">${score}<span class="text-sm text-slate-400">%</span></span>
            </div>
        </div>
        <div class="w-full bg-slate-100 rounded-full h-2 mb-4">
            <div class="bg-gradient-to-r from-blue-400 to-primary h-2 rounded-full transition-all duration-[2000ms]" style="width: ${score}%"></div>
        </div>
        <p class="text-slate-600 text-base leading-relaxed">
            ${data.pronunciation_feedback || "Goed gedaan!"}
        </p>
    </div>`;
    feedbackContainer.insertAdjacentHTML('beforeend', pronHtml);

    // 2. Grammar Card
    if (data.grammar_correction) {
        const diff = getDiffHtml(userText || data.transcript, data.grammar_correction);
        const grammarHtml = `
        <div class="group bg-white rounded-xl p-5 mb-4 border-4 border-dashed border-teal-200 shadow-sm hover:border-teal-300 transition-colors">
            <div class="flex justify-between items-start mb-4">
                <div class="flex items-center gap-3">
                    <div class="size-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-500">
                        <span class="material-symbols-outlined">spellcheck</span>
                    </div>
                    <h4 class="font-bold text-lg text-slate-900">Grammatica</h4>
                </div>
            </div>
            <div class="space-y-4">
                <div class="bg-red-50 p-3 rounded-lg border-l-2 border-red-300">
                    <p class="text-xs font-bold text-red-400 uppercase mb-1 tracking-wider">Jouw zin</p>
                    <div class="text-slate-700 text-lg leading-snug">
                        "${diff.userHtml}"
                    </div>
                </div>
                <div class="flex justify-center -my-2 relative z-10">
                    <div class="bg-white p-1 rounded-full border border-slate-200 shadow-sm">
                        <span class="material-symbols-outlined text-slate-400 text-sm">arrow_downward</span>
                    </div>
                </div>
                <div class="bg-green-50 p-3 rounded-lg border-l-2 border-green-400">
                    <p class="text-xs font-bold text-green-700 uppercase mb-1 tracking-wider">Correctie</p>
                    <div class="text-slate-900 text-lg font-bold leading-snug">
                        "${diff.correctHtml}"
                    </div>
                </div>
            </div>
        </div>`;
        feedbackContainer.insertAdjacentHTML('beforeend', grammarHtml);
    }

    // 3. Better Alternative Card
    const altText = data.better_alternative || data.response;
    if (altText) {
        const alternativeHtml = `
        <div class="group bg-white rounded-xl p-5 border-4 border-dashed border-teal-200 shadow-sm relative overflow-hidden">
            <div class="absolute -right-6 -top-6 size-32 bg-primary/10 rounded-full blur-2xl pointer-events-none"></div>
            <div class="flex justify-between items-start mb-3 relative z-10">
                <div class="flex items-center gap-3">
                    <div class="size-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-500">
                        <span class="material-symbols-outlined">auto_awesome</span>
                    </div>
                    <h4 class="font-bold text-lg text-slate-900">Beter alternatief</h4>
                </div>
            </div>
            <p class="text-slate-500 text-sm mb-3 relative z-10">Een natuurlijkere manier om dit te zeggen:</p>
            <div class="bg-slate-50 p-4 rounded-lg border border-slate-200 relative z-10">
                <p class="text-slate-800 text-lg font-medium italic">"${altText}"</p>
            </div>
            <div class="flex gap-2 mt-4 relative z-10">
                <button onclick="speak('${altText.replace(/'/g, "\\'")}')" 
                    class="flex-1 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-sm font-bold text-slate-700 flex items-center justify-center gap-2 transition-colors">
                    <span class="material-symbols-outlined text-[20px]">volume_up</span> Luister
                </button>
            </div>
        </div>`;
        feedbackContainer.insertAdjacentHTML('beforeend', alternativeHtml);
    }
}

function getDiffHtml(user, correct) {
    if (!correct || !user) return { userHtml: user || "", correctHtml: correct || "" };

    const uWords = user.split(/\s+/);
    const cWords = correct.split(/\s+/);

    let uHtml = user;
    let cHtml = correct;

    // This is a simplified diff. For the exact look in the image, we highlight specific words.
    // We try to find words in user that are not in correct and vice versa.

    // Highlight differences in the correct string
    cWords.forEach(word => {
        const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
        if (cleanWord && !user.toLowerCase().includes(cleanWord.toLowerCase())) {
            cHtml = cHtml.replace(word, `<span class="text-green-600 underline decoration-green-500 decoration-2 underline-offset-4">${word}</span>`);
        }
    });

    // Strikethrough differences in the user string
    uWords.forEach(word => {
        const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
        if (cleanWord && !correct.toLowerCase().includes(cleanWord.toLowerCase())) {
            uHtml = uHtml.replace(word, `<span class="line-through decoration-red-400/60 decoration-2 text-slate-400">${word}</span>`);
        }
    });

    return { userHtml: uHtml, correctHtml: cHtml };
}

function speak(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'nl-BE';

    const voices = window.speechSynthesis.getVoices();
    const flemishVoice = voices.find(v => v.lang.includes('BE') || v.name.includes('Belg') || v.name.includes('Vlaams'));
    const dutchVoice = voices.find(v => v.lang.includes('nl'));

    if (flemishVoice) utterance.voice = flemishVoice;
    else if (dutchVoice) utterance.voice = dutchVoice;

    window.speechSynthesis.speak(utterance);
}

// Pre-load voices
window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
};
