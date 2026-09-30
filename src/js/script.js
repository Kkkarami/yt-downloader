const urlInput = document.getElementById("urlInput");
const searchButton = document.getElementById("searchButton");
const result = document.getElementById("result");

const audioSection = document.getElementById("audioSection");
const popularLanguages = document.getElementById("popularLanguages");
const otherLanguages = document.getElementById("otherLanguages");
const languageSearch = document.getElementById("languageSearch");
const languageSuggestions = document.getElementById("languageSuggestions");
const videoQuality = document.getElementById("videoQuality");
const downloadButton = document.getElementById("downloadButton");
const downloadProgress = document.getElementById("downloadProgress");
const downloadStatus = document.getElementById("downloadStatus");
const downloadPercent = document.getElementById("downloadPercent");
const downloadProgressFill = document.getElementById("downloadProgressFill");

let selectedAudio = null;
let selectedVideo = null;
let otherTracks = [];
let videoTracks = [];
let videoTitle = "";

searchButton.addEventListener("click", async () => {
    const url = urlInput.value.trim();


    if (!url) {
        result.textContent = "Вставте посилання на YouTube";
        return;
    }

    result.textContent = "Завантаження інформації...";
    audioSection.classList.add("hidden");

    try {
        const response = await fetch(`/info?url=${encodeURIComponent(url)}`);
        const data = await response.json();

        if (!response.ok) {
            result.textContent = data.error || "Сталася помилка";
            return;
        }

        videoTitle = data.title;

        result.innerHTML = `
            <h2>${data.title}</h2>
        `;

        showPopularLanguages(data.popular);

        otherTracks = data.other;

        videoTracks = data.videoQuality;
        showVideoQuality(videoTracks);

        audioSection.classList.remove("hidden");
        downloadButton.classList.remove("hidden");

    } catch (error) {
        result.textContent = "Не вдалося підключитися до сервера";
    }
});

function showPopularLanguages(tracks) {
    popularLanguages.innerHTML = "";

    for (const track of tracks) {
        const element = createLanguageElement(track);
        popularLanguages.appendChild(element);
    }
}

function showOtherLanguages(tracks) {
    otherLanguages.innerHTML = "";

    for (const track of tracks) {
        const element = createLanguageElement(track);
        otherLanguages.appendChild(element);
    }
}

function createLanguageElement(track) {
    const element = document.createElement("div");

    element.className = "language";

    let flag = "";

    if (track.language === "uk") {
        flag = "🇺🇦";
    } else if (track.language.startsWith("en")) {
        flag = "🇬🇧";
    }

    element.innerHTML = `
        <div class="language-name">
            ${flag} ${track.name}
        </div>

        <div class="language-type">
            ${track.type === "AI" ? "AI" : "Original"}
        </div>
    `;

    element.addEventListener("click", () => {
        document.querySelectorAll(".language").forEach(item => {
            item.classList.remove("selected");
        });

        element.classList.add("selected");

        selectedAudio = track;

        console.log("Вибрана аудіодоріжка:", selectedAudio);
    });

    return element;
}

function showVideoQuality(tracks) {
    videoQuality.innerHTML = "";

    for (const track of tracks) {
        const element = document.createElement("div");

        element.className = "quality";
        element.textContent = track.resolution;

        element.addEventListener("click", () => {
            document.querySelectorAll(".quality").forEach(item => {
                item.classList.remove("selected");
            });

            element.classList.add("selected");

            selectedVideo = track;

            console.log("Вибрана якість:", selectedVideo);
        });

        videoQuality.appendChild(element);
    }
}

languageSearch.addEventListener("input", () => {
    const search = languageSearch.value.toLowerCase().trim();

    languageSuggestions.innerHTML = "";

    if (!search) {
        return;
    }

    const filteredTracks = otherTracks.filter(track =>
        track.name.toLowerCase().includes(search)
    );

    for (const track of filteredTracks) {
        const element = document.createElement("div");

        element.className = "language-suggestion";

        element.innerHTML = `
            <div class="language-suggestion-name">
                ${track.name}
            </div>

            <div class="language-suggestion-type">
                ${track.type === "AI" ? "AI" : "Original"}
            </div>
        `;

        element.addEventListener("click", () => {
            document.querySelectorAll(".language").forEach(item => {
                item.classList.remove("selected");
            });

            selectedAudio = track;

            languageSearch.value = track.name;
            languageSuggestions.innerHTML = "";

            console.log("Вибрана аудіодоріжка:", selectedAudio);
        });

        languageSuggestions.appendChild(element);
    }
});

downloadButton.addEventListener("click", async () => {
    if (!selectedAudio) {
        alert("Виберіть аудіодоріжку");
        return;
    }

    if (!selectedVideo) {
        alert("Виберіть якість відео");
        return;
    }

    const url = urlInput.value.trim();

    downloadButton.disabled = true;
    downloadButton.textContent = "Завантаження...";

    downloadProgress.classList.remove("hidden");

    downloadStatus.textContent = "Підготовка...";
    downloadPercent.textContent = "0%";
    downloadProgressFill.style.width = "0%";

    try {
        const response = await fetch(
            `/download?url=${encodeURIComponent(url)}` +
            `&video=${encodeURIComponent(selectedVideo.id)}` +
            `&audio=${encodeURIComponent(selectedAudio.id)}` +
            `&title=${encodeURIComponent(videoTitle)}`
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Помилка завантаження");
        }

        const downloadId = data.id;

        const checkProgress = setInterval(async () => {
            try {
                const response = await fetch(
                    `/download-status?id=${encodeURIComponent(downloadId)}`
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error);
                }

                const progress = Math.round(data.progress);

                downloadPercent.textContent = `${progress}%`;
                downloadProgressFill.style.width = `${progress}%`;

                if (data.status === "starting") {
                    downloadStatus.textContent = "Підготовка...";
                }

                if (data.status === "downloading") {
                    downloadStatus.textContent = "Завантаження...";
                }

                if (data.status === "ready") {
                    clearInterval(checkProgress);

                    downloadStatus.textContent = "Готово";
                    downloadPercent.textContent = "100%";
                    downloadProgressFill.style.width = "100%";

                    window.location.href =
                        `/download-file?id=${encodeURIComponent(downloadId)}`;

                    downloadButton.textContent = "Завантажити";
                    downloadButton.disabled = false;
                }

                if (data.status === "error") {
                    clearInterval(checkProgress);

                    throw new Error("Помилка завантаження");
                }

            } catch (error) {
                clearInterval(checkProgress);

                downloadStatus.textContent = "Помилка";
                downloadPercent.textContent = "";
                downloadProgressFill.style.width = "0%";

                downloadButton.textContent = "Завантажити";
                downloadButton.disabled = false;

                alert(error.message);
            }
        }, 500);

    } catch (error) {
        downloadStatus.textContent = "Помилка";
        downloadPercent.textContent = "";
        downloadProgressFill.style.width = "0%";

        downloadButton.textContent = "Завантажити";
        downloadButton.disabled = false;

        alert(error.message);
    }
});