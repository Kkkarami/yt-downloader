const express = require("express");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

const app = express();
const PORT = 3000;
const downloads = new Map();

app.use(express.static(path.join(__dirname)));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "index.html"));
});

app.get("/info", (req, res) => {
    const url = req.query.url;

    if (!url) {
        return res.status(400).json({
            error: "Не вказано URL"
        });
    }

    const ytdlp = spawn("D:\\yt-dlp\\yt-dlp.exe", [
        "--dump-single-json",
        "--no-warnings",
        url
    ]);

    let output = "";
    let error = "";

    ytdlp.stdout.on("data", (data) => {
        output += data.toString();
    });

    ytdlp.stderr.on("data", (data) => {
        error += data.toString();
    });

    ytdlp.on("close", (code) => {
        if (code !== 0) {
            return res.status(500).json({
                error: error
            });
        }

        try {
            const info = JSON.parse(output);

            const audioFormats = info.formats
                .filter(format =>
                    format.acodec !== "none" &&
                    format.vcodec === "none"
                );

            const languages = new Map();

            for (const format of audioFormats) {
                const language = format.language;

                if (!language) {
                    continue;
                }

                if (!languages.has(language)) {
                    languages.set(language, {
                        id: format.format_id,
                        language: language,
                        name: language,
                        type: "original"
                    });
                }

                const track = format.audioTrack;

                if (track) {
                    if (track.displayName) {
                        languages.get(language).name = track.displayName;
                    }

                    if (track.id && track.id.includes("dubbed")) {
                        languages.get(language).type = "AI";
                    }
                }

                if (format.format_note && format.format_note.includes("dubbed-auto")) {
                    languages.get(language).type = "AI";
                }
            }

            const languageNames = new Intl.DisplayNames(["uk"], {
                type: "language"
            });

            for (const track of languages.values()) {
                try {
                    track.name = languageNames.of(track.language);
                } catch {
                    track.name = track.language;
                }
            }

            const popular = [];
            const other = [];

            for (const track of languages.values()) {
                if (track.language === "uk") {
                    track.name = "Українська";
                    popular.push(track);
                } else if (track.language.startsWith("en")) {
                    track.name = "English";
                    popular.push(track);
                } else {
                    other.push(track);
                }
            }

            popular.sort((a, b) => {
                if (a.language === "uk") return -1;
                if (b.language === "uk") return 1;
                return 0;
            });

            const videoMap = new Map();

            const videoFormats = info.formats
                .filter(format =>
                    format.vcodec !== "none" &&
                    format.acodec === "none" &&
                    format.height
                );

            for (const format of videoFormats) {
                const height = format.height;

                if (!videoMap.has(height)) {
                    videoMap.set(height, {
                        id: format.format_id,
                        resolution: `${height}p`,
                        width: format.width,
                        height: format.height,
                        fps: format.fps,
                        codec: format.vcodec,
                        format: format.ext
                    });
                }

                const current = videoMap.get(height);

                if (
                    format.ext === "mp4" &&
                    format.vcodec.startsWith("avc1")
                ) {
                    current.id = format.format_id;
                    current.codec = format.vcodec;
                    current.format = format.ext;
                }
            }

            const videoQuality = Array.from(videoMap.values())
                .sort((a, b) => a.height - b.height);

            res.json({
                title: info.title,
                duration: info.duration,
                popular,
                other,
                videoQuality
            });

        } catch (e) {
            res.status(500).json({
                error: "Не вдалося обробити відповідь yt-dlp"
            });
        }
    });
});

app.get("/download", (req, res) => {
    const url = req.query.url;
    const video = req.query.video;
    const audio = req.query.audio;
    const title = req.query.title;

    if (!url || !video || !audio) {
        return res.status(400).json({
            error: "Не вказано URL, відео або аудіо"
        });
    }

    const safeTitle = (title || "video")
        .replace(/[<>:"/\\|?*]/g, "")
        .replace(/[. ]+$/, "")
        .trim() || "video";

    const id = Date.now().toString();

    const outputPath = path.join(
        os.tmpdir(),
        `youtube-${id}.mp4`
    );

    downloads.set(id, {
        progress: 0,
        status: "starting",
        outputPath,
        filename: `${safeTitle}.mp4`
    });

    res.json({
        id
    });

    const ytdlp = spawn("D:\\yt-dlp\\yt-dlp.exe", [
        "--ffmpeg-location",
        "D:\\ffmpeg\\bin",
        "-f",
        `${video}+${audio}`,
        "-o",
        outputPath,
        "--merge-output-format",
        "mp4",
        "--newline",
        url
    ]);

    ytdlp.stdout.on("data", (data) => {
        const text = data.toString();

        console.log(text);

        const match = text.match(/(\d+(?:\.\d+)?)%/);

        if (match) {
            const progress = Number(match[1]);

            downloads.set(id, {
                ...downloads.get(id),
                progress,
                status: "downloading",
                outputPath
            });
        }
    });

    ytdlp.stderr.on("data", (data) => {
        const text = data.toString();

        console.log(text);

        const match = text.match(/(\d+(?:\.\d+)?)%/);

        if (match) {
            const progress = Number(match[1]);

            downloads.set(id, {
                ...downloads.get(id),
                progress,
                status: "downloading",
                outputPath
            });
        }
    });

    ytdlp.on("close", (code) => {
        console.log("yt-dlp завершив роботу. Код:", code);

        if (code !== 0) {
            downloads.set(id, {
                ...downloads.get(id),
                progress: 0,
                status: "error",
                outputPath
            });

            return;
        }

        downloads.set(id, {
            ...downloads.get(id),
            progress: 100,
            status: "ready",
            outputPath
        });

        console.log("Файл готовий:", outputPath);
    });
});

app.get("/download-status", (req, res) => {
    const id = req.query.id;

    if (!id || !downloads.has(id)) {
        return res.status(404).json({
            error: "Завантаження не знайдено"
        });
    }

    res.json(downloads.get(id));
});

app.get("/download-file", (req, res) => {
    const id = req.query.id;

    if (!id || !downloads.has(id)) {
        return res.status(404).json({
            error: "Завантаження не знайдено"
        });
    }

    const download = downloads.get(id);

    if (download.status !== "ready") {
        return res.status(400).json({
            error: "Файл ще не готовий"
        });
    }

    res.download(download.outputPath, download.filename, (error) => {
        if (error) {
            console.log(error);
        }

        fs.unlink(download.outputPath, () => {
            downloads.delete(id);
            console.log("Тимчасовий файл видалено");
        });
    });
});

app.listen(PORT, () => {
    console.log(`Server started: http://localhost:${PORT}`);
});