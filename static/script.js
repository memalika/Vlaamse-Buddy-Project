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
        <h3 class="text-slate-900 text-[18px] font-black tracking-[-0.03em]">Analyse & Feedback</h3>
        <div class="flex items-center gap-1.5 px-3 py-1 bg-[#ccfbf1] rounded-full">
            <span class="material-symbols-outlined text-green-600" style="font-size: 14px;">check_circle</span>
            <span class="text-[11px] font-extrabold text-[#0f766e]">Voltooid</span>
        </div>
    </div>`;
    feedbackContainer.insertAdjacentHTML('beforeend', headerHtml);

    // 1. Pronunciation Card
    const score = data.pronunciation_score || 0;
    const pronHtml = `
    <div class="bg-white rounded-[2rem] p-6 mb-5 border-[2.5px] border-dashed border-[#a7f3d0]">
        <div class="flex justify-between items-center mb-4">
            <div class="flex items-center gap-3">
                <div class="size-8 rounded-full bg-[#eff6ff] flex items-center justify-center text-[#3b82f6]">
                    <span class="material-symbols-outlined text-[18px]">graphic_eq</span>
                </div>
                <h4 class="font-bold text-[16px] text-slate-900">Uitspraak</h4>
            </div>
            <div class="flex items-baseline gap-0.5">
                <span class="text-[26px] font-black text-slate-800 tracking-tight leading-none">${score}</span><span class="text-[14px] font-bold text-slate-400 leading-none">%</span>
            </div>
        </div>
        <div class="w-full bg-[#f1f5f9] rounded-full h-1.5 mb-5 overflow-hidden">
            <div class="bg-gradient-to-r from-[#60a5fa] via-[#34d399] to-[#2bee79] h-full rounded-full transition-all duration-[2000ms]" style="width: ${score}%"></div>
        </div>
        <p class="text-[#64748b] text-[13px] leading-snug">
            ${data.pronunciation_feedback || "Goed gedaan!"}
        </p>
    </div>`;
    feedbackContainer.insertAdjacentHTML('beforeend', pronHtml);

    // 2. Grammar Card
    if (data.grammar_correction) {
        const diff = getDiffHtml(userText || data.transcript, data.grammar_correction);
        const grammarHtml = `
        <div class="bg-white rounded-[2rem] p-6 mb-5 border-[2.5px] border-dashed border-[#a7f3d0]">
            <div class="flex items-center gap-3 mb-5">
                <div class="size-8 rounded-full bg-[#fff7ed] flex items-center justify-center text-[#f97316]">
                    <span class="material-symbols-outlined text-[18px]">spellcheck</span>
                </div>
                <h4 class="font-bold text-[16px] text-slate-900">Grammatica</h4>
            </div>
            
            <div class="bg-[#fff1f2] px-5 py-4 rounded-[1.25rem] relative">
                <p class="text-[10px] font-black text-[#f87171] uppercase tracking-[0.05em] mb-1">JOUW ZIN</p>
                <div class="text-[#334155] text-[14px] font-medium leading-relaxed">
                    "${diff.userHtml}"
                </div>
            </div>
            
            <div class="flex justify-center relative z-10 items-center -my-3 block">
                <div class="bg-white size-6 flex items-center justify-center rounded-full border border-slate-100 shadow-sm relative z-20">
                    <span class="material-symbols-outlined text-slate-300 text-[14px]">arrow_downward</span>
                </div>
            </div>
            
            <div class="bg-[#ecfdf5] px-5 py-4 rounded-[1.25rem] relative">
                <p class="text-[10px] font-black text-[#10b981] uppercase tracking-[0.05em] mb-1">CORRECTIE</p>
                <div class="text-[#0f172a] text-[14px] font-bold leading-relaxed">
                    "${diff.correctHtml}"
                </div>
            </div>
        </div>`;
        feedbackContainer.insertAdjacentHTML('beforeend', grammarHtml);
    }

    // 3. Better Alternative Card
    const altText = data.better_alternative || data.response;
    if (altText) {
        const alternativeHtml = `
        <div class="bg-white rounded-[2rem] p-6 border-[2.5px] border-dashed border-[#a7f3d0]">
            <div class="flex items-center gap-3 mb-4">
                <div class="size-8 rounded-full bg-[#f3e8ff] flex items-center justify-center text-[#a855f7]">
                    <span class="material-symbols-outlined text-[18px]">auto_awesome</span>
                </div>
                <h4 class="font-bold text-[16px] text-slate-900">Beter alternatief</h4>
            </div>
            
            <p class="text-[#64748b] text-[12px] font-medium mb-4">Een natuurlijkere manier om dit te zeggen:</p>
            
            <div class="border border-slate-100 bg-[#f8fafc] p-5 rounded-[1.25rem] mb-4">
                <p class="text-[#1e293b] text-[14px] font-bold italic leading-relaxed">"${altText}"</p>
            </div>
            
            <button onclick="speak('${altText.replace(/'/g, "\\'")}')" 
                class="w-full py-3 rounded-xl bg-[#f8fafc] hover:bg-[#f1f5f9] active:bg-[#e2e8f0] text-[13px] font-bold text-[#334155] flex items-center justify-center gap-2 transition-colors border border-slate-100 shadow-sm">
                <span class="material-symbols-outlined text-[16px]">volume_up</span> Luister
            </button>
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

    cWords.forEach(word => {
        const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
        if (cleanWord && !user.toLowerCase().includes(cleanWord.toLowerCase())) {
            cHtml = cHtml.replace(word, `<span class="text-[#10b981] underline decoration-[#10b981] decoration-[2px] underline-offset-4 font-bold">\${word}</span>`);
        }
    });

    uWords.forEach(word => {
        const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
        if (cleanWord && !correct.toLowerCase().includes(cleanWord.toLowerCase())) {
            uHtml = uHtml.replace(word, `<span class="text-[#f87171] font-bold">\${word}</span>`);
        }
    });

    return { userHtml: uHtml, correctHtml: cHtml };
}

let availableVoices = [];
function loadVoices() {
    availableVoices = window.speechSynthesis.getVoices();
}
if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();
}

function speak(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    
    let voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) voices = availableVoices;
    
    const playAudio = () => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'nl-BE'; 
        
        voices = window.speechSynthesis.getVoices();
        if (voices.length === 0) voices = availableVoices;
        
        // 1. Try to find a precise Flemish (Belgian Dutch) voice
        let selectedVoice = voices.find(v => 
            v.lang.toLowerCase() === 'nl-be' || 
            v.lang.toLowerCase() === 'nl_be' || 
            v.name.toLowerCase().includes('belg') || 
            v.name.toLowerCase().includes('vlaam') ||
            v.name.toLowerCase().includes('ellen') || // Mac/iOS Flemish
            v.name.toLowerCase().includes('xander')   // Mac/iOS Flemish
        );
        
        // 2. Fallback to any Dutch voice
        if (!selectedVoice) {
            selectedVoice = voices.find(v => 
                v.lang.toLowerCase().startsWith('nl') || 
                v.name.toLowerCase().includes('dutch') || 
                v.name.toLowerCase().includes('nederland') ||
                v.name.toLowerCase().includes('laura') || // Mac/iOS Dutch
                v.name.toLowerCase().includes('xenia')    // Mac/iOS Dutch
            );
        }
        
        if (selectedVoice) {
            utterance.voice = selectedVoice;
            utterance.lang = selectedVoice.lang; // Force the engine to use this voice's language model
        } else {
            // Strong fallback for mobile if voice array is still empty
            // iOS often defaults to English if nl-BE isn't found, nl-NL has wider support
            utterance.lang = 'nl-NL';
        }
        
        // Slightly slower rate often sounds more natural on mobile TTS
        utterance.rate = 0.95;
        
        utterance.onerror = (e) => console.error("Speech Synthesis Error:", e);
        
        window.speechSynthesis.speak(utterance);
        
        // iOS Safari workaround: sometimes it pauses indefinitely
        if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
        }
    };

    // Mobile/iOS Safari often returns empty voices initially. Wait slightly if empty.
    if (voices.length === 0) {
        let attempts = 0;
        const checkVoices = setInterval(() => {
            voices = window.speechSynthesis.getVoices();
            attempts++;
            if (voices.length > 0 || attempts > 10) {
                clearInterval(checkVoices);
                availableVoices = voices;
                playAudio();
            }
        }, 100);
    } else {
        playAudio();
    }
}
