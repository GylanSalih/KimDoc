# 📚 Berichtsheft Helper

Ein intelligenter Berichtsheft-Generator, der verschiedene APIs integriert und mit KI-Unterstützung automatisch Wochenberichte erstellt.

## ✨ Features

- 📅 **Interaktiver Kalender** - Woche für Woche auswählen (Mo-Fr)
- 🏫 **WebUntis Integration** - Automatischer Stundenplan-Import
- 🎓 **Logineo/Moodle Support** - Aufgaben und Noten abrufen
- 🤖 **KI-Integration** - ChatGPT, Groq oder Ollama für Berichtsheft-Generierung
- 📊 **Multi-API Dashboard** - Jira, GitHub, WebUntis, LMS in einer Oberfläche
- 🎨 **Modernes UI** - Responsive Design mit SCSS

## 🚀 Installation

### Voraussetzungen

- Node.js (Version 18 oder höher)
- npm oder yarn
- Git

### Setup

1. **Repository klonen**
```bash
git clone https://github.com/GylanSalih/KimDoc.git
cd KimDoc
```

2. **Dependencies installieren**
```bash
npm install
```

3. **Konfiguration einrichten**
```bash
# Kopiere die Beispiel-Konfiguration
cp public/config.json.example public/config.json
```

4. **Config-Datei bearbeiten**
Öffne `public/config.json` und trage deine API-Credentials ein:

```json
{
  "untis_username": "dein-webuntis-benutzername",
  "untis_password": "dein-webuntis-passwort",
  "ai_method": "openai",
  "openai_key": "dein-openai-api-key",
  "groq_key": "dein-groq-api-key",
  "ollama_model": "llama2",
  "ai_prompt": "Erstelle einen detaillierten Berichtsheft-Eintrag basierend auf den Stundenplan-Daten."
}
```

## 🛠️ Entwicklung

### Lokaler Server starten
```bash
npm run dev
```
Die Anwendung ist dann unter `http://localhost:5173` verfügbar.

### Build für Produktion
```bash
npm run build
```

### Code-Qualität
```bash
# Linting
npm run lint

# Linting mit Auto-Fix
npm run lint:fix

# TypeScript-Check
npm run type-check

# Code-Formatierung
npm run format
```

## 📋 API-Integrationen

### WebUntis
- **Schule**: Städt. Heinrich-Hertz-Schule Düsseldorf
- **URL**: `https://ajax.webuntis.com/WebUntis`
- **Authentifizierung**: Benutzername/Passwort
- **Daten**: Stundenplan, Hausaufgaben, Prüfungen

### Logineo/Moodle
- **URL**: `https://lms.hhbk.de`
- **Authentifizierung**: Benutzername/Passwort
- **Daten**: Kurse, Aufgaben, Noten

### KI-Services
- **OpenAI**: ChatGPT-Integration
- **Groq**: Alternative KI-API
- **Ollama**: Lokale KI-Modelle

## 🏗️ Projektstruktur

```
KIM-DOC/
├── public/
│   ├── config.json          # API-Konfiguration
│   └── index.html
├── src/
│   ├── Pages/
│   │   └── PageOne/         # Haupt-Berichtsheft-Seite
│   │       ├── PageOne.tsx
│   │       └── PageOne.scss
│   ├── services/
│   │   ├── untisService.ts  # WebUntis API
│   │   ├── logineoService.ts # Logineo/Moodle API
│   │   └── aiService.ts     # KI-Integration
│   ├── utils/
│   │   ├── config.ts        # Konfigurations-Manager
│   │   └── dateUtils.ts     # Datum-Hilfsfunktionen
│   ├── index.scss           # Globale Styles
│   └── main.tsx
├── vercel.json              # Vercel-Deployment-Konfiguration
├── vite.config.ts           # Vite-Konfiguration
└── package.json
```

## 🎯 Verwendung

1. **Wochen auswählen**: Klicke auf die gewünschten Wochen im Kalender
2. **APIs verbinden**: Aktiviere und verbinde WebUntis, Logineo und KI-Services
3. **Berichtsheft generieren**: Klicke auf "Generate" für automatische Berichtsheft-Einträge
4. **Anpassen**: Bearbeite die generierten Texte nach Bedarf

## 🔧 Konfiguration

### WebUntis
```json
{
  "untis_username": "dein-benutzername",
  "untis_password": "dein-passwort"
}
```

### KI-Services
```json
{
  "ai_method": "openai|groq|ollama",
  "openai_key": "sk-...",
  "groq_key": "gsk_...",
  "ollama_model": "llama2|mistral|codellama"
}
```

## 🚀 Deployment

### Vercel (Empfohlen)
1. Verbinde dein GitHub-Repository mit Vercel
2. Vercel erkennt automatisch die `vercel.json`-Konfiguration
3. Deploy erfolgt automatisch bei jedem Push

### Andere Plattformen
```bash
# Build erstellen
npm run build

# Statische Dateien aus dem dist/ Ordner deployen
```

## 🐛 Troubleshooting

### WebUntis-Verbindung
- Überprüfe Benutzername/Passwort in `config.json`
- Stelle sicher, dass die Schule korrekt ist (Heinrich-Hertz-Schule)
- Prüfe die Browser-Konsole auf CORS-Fehler

### Build-Fehler
```bash
# Dependencies neu installieren
rm -rf node_modules package-lock.json
npm install

# Cache leeren
npm run build -- --force
```

### Vercel 404-Fehler
- Stelle sicher, dass `vercel.json` im Root-Verzeichnis liegt
- Überprüfe, dass der Build erfolgreich ist
- Prüfe die Vercel-Logs im Dashboard

## 📝 Entwicklung

### Neue API hinzufügen
1. Erstelle neuen Service in `src/services/`
2. Füge Konfiguration in `public/config.json` hinzu
3. Integriere in `PageOne.tsx`

### Styling anpassen
- Globale Styles: `src/index.scss`
- Komponenten-Styles: `src/Pages/PageOne/PageOne.scss`
- SCSS-Variablen für Theme-Anpassungen

## 🤝 Contributing

1. Fork das Repository
2. Erstelle einen Feature-Branch (`git checkout -b feature/AmazingFeature`)
3. Committe deine Änderungen (`git commit -m 'Add some AmazingFeature'`)
4. Push zum Branch (`git push origin feature/AmazingFeature`)
5. Öffne einen Pull Request

## 📄 Lizenz

Dieses Projekt steht unter der MIT-Lizenz. Siehe `LICENSE` für Details.

## 👨‍💻 Autor

**Gylan Salih**
- GitHub: [@GylanSalih](https://github.com/GylanSalih)

## 🙏 Danksagungen

- WebUntis für die API-Dokumentation
- Vercel für das Hosting
- Die Open-Source-Community für die verwendeten Libraries

---

**Hinweis**: Dieses Tool ist für Bildungszwecke entwickelt. Stelle sicher, dass du die Nutzungsbedingungen der integrierten APIs einhältst.