import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import csvParser from "csv-parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const csvFilePath = path.join(__dirname, "../websites.csv");
const templateDir = path.join(__dirname, "../template-app");
const buildDir = path.join(__dirname, "build");

if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir);

// Copy folder recursively
function copyRecursiveSync(src, dest) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

    fs.readdirSync(src).forEach((item) => {
        const srcPath = path.join(src, item);
        const destPath = path.join(dest, item);

        if (fs.lstatSync(srcPath).isDirectory()) {
            copyRecursiveSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    });
}

// Replace placeholders inside files
function replacePlaceholders(filePath, replacements) {
    let content = fs.readFileSync(filePath, "utf8");

    Object.keys(replacements).forEach((key) => {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
        content = content.replace(regex, replacements[key]);
    });

    fs.writeFileSync(filePath, content, "utf8");
}
const HERO_WORDS = ["Quick", "Fast", "Speedy"];
let usedWords = [];
function replaceHeroPlaceholders(filePath) {
    let content = fs.readFileSync(filePath, "utf8");

    // Pick available words
    let available = HERO_WORDS.filter(w => !usedWords.includes(w));
    if (available.length === 0) {
        usedWords = []; // reset if all used
        available = [...HERO_WORDS];
    }

    const word = available[Math.floor(Math.random() * available.length)];
    usedWords.push(word);
    content = content.replace(/\[\[\s*Quick\s*\|\s*Fast\s*\|\s*Speedy\s*\]\]/, word);
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`  ✅ Hero text replaced with: ${word}`);
}


// Process each row from CSV
function processRow(row) {
    const domain = row.domain.trim();
    const targetDir = path.join(buildDir, domain);

    console.log(`\n🔹 Building site for: ${domain}`);

    // Copy template
    copyRecursiveSync(templateDir, targetDir);

    // Replace placeholders in source files
    const srcDir = path.join(targetDir, "src");
    if (fs.existsSync(srcDir)) {
        fs.readdirSync(srcDir).forEach((file) => {
            const filePath = path.join(srcDir, file);
            if (fs.lstatSync(filePath).isFile()) {
                replacePlaceholders(filePath, {
                    phone: row.phone || "N/A",
                    address: row.address || "N/A",
                    email: row.email || "N/A",
                });

            }
            let content = fs.readFileSync(filePath, "utf8");
            if (/\[\[\s*Quick\s*\|\s*Fast\s*\|\s*Speedy\s*\]\]/.test(content)) {
                replaceHeroPlaceholders(filePath);
            }
        });
    }

    // Update Vite index.html title
    const indexHtmlPath = path.join(targetDir, "index.html");
    if (fs.existsSync(indexHtmlPath)) {
        let indexHtml = fs.readFileSync(indexHtmlPath, "utf8");
        const title = row.title || domain;
        indexHtml = indexHtml.replace(/<title>.*<\/title>/i, `<title>${title}</title>`);
        fs.writeFileSync(indexHtmlPath, indexHtml, "utf8");
        console.log(`  ✅ index.html title set to: ${title}`);
    } else {
        console.warn(`⚠ No index.html found for ${domain}, skipping title replacement.`);
    }

    // Run the dev server (Vite = npm run dev)
    const port = 3000 + Math.floor(Math.random() * 500); // random port to avoid conflicts
    const child = spawn("npm", ["run", "dev"], {
        cwd: targetDir,
        env: { ...process.env, PORT: String(port) },
        stdio: "inherit",
        shell: true,
    });

    child.on("error", (err) => {
        console.error(`❌ Failed to start dev server for ${domain}:`, err);
    });
}

// Read CSV
fs.createReadStream(csvFilePath)
    .pipe(csvParser())
    .on("data", (row) => {
        processRow(row);
    })
    .on("end", () => {
        console.log("\n✅ All sites built successfully!");
    });
