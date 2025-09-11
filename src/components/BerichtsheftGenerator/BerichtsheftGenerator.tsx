import React, { useState } from 'react';
import { generateBerichtsheftText, generateDetailedBerichtsheftText, improveBerichtsheftText } from '../../services/groqService';
import './BerichtsheftGenerator.scss';

interface BerichtsheftGeneratorProps {
  onTextGenerated?: (text: string) => void;
  initialDescription?: string;
}

const BerichtsheftGenerator: React.FC<BerichtsheftGeneratorProps> = ({ 
  onTextGenerated, 
  initialDescription = '' 
}) => {
  const [description, setDescription] = useState(initialDescription);
  const [context, setContext] = useState('');
  const [generatedText, setGeneratedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'simple' | 'detailed' | 'improve'>('simple');

  const handleGenerate = async () => {
    if (!description.trim()) {
      setError('Bitte gib eine Beschreibung ein');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      let result = '';
      
      switch (mode) {
        case 'simple':
          result = await generateBerichtsheftText(description);
          break;
        case 'detailed':
          result = await generateDetailedBerichtsheftText(description, context);
          break;
        case 'improve':
          result = await improveBerichtsheftText(description);
          break;
      }

      setGeneratedText(result);
      // Nur hinzufügen, wenn onTextGenerated definiert ist
      if (onTextGenerated) {
        onTextGenerated(result);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Ein Fehler ist aufgetreten');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedText);
  };

  const handleClear = () => {
    setDescription('');
    setContext('');
    setGeneratedText('');
    setError('');
  };

  return (
    <div className="berichtsheft-generator">
      <div className="generator-header">
        <h3>🤖 Berichtsheft-Generator</h3>
        <p>Generiere professionelle Berichtsheft-Texte mit Groq AI</p>
      </div>

      <div className="mode-selector">
        <label>
          <input
            type="radio"
            name="mode"
            value="simple"
            checked={mode === 'simple'}
            onChange={(e) => setMode(e.target.value as 'simple')}
          />
          Einfache Stichpunkte
        </label>
        <label>
          <input
            type="radio"
            name="mode"
            value="detailed"
            checked={mode === 'detailed'}
            onChange={(e) => setMode(e.target.value as 'detailed')}
          />
          Detaillierter Bericht
        </label>
        <label>
          <input
            type="radio"
            name="mode"
            value="improve"
            checked={mode === 'improve'}
            onChange={(e) => setMode(e.target.value as 'improve')}
          />
          Text verbessern
        </label>
      </div>

      <div className="input-section">
        <div className="form-group">
          <label htmlFor="description">
            {mode === 'improve' ? 'Bestehender Text zum Verbessern:' : 'Ticket/Projekt Beschreibung:'}
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={
              mode === 'improve' 
                ? 'Füge hier den Text ein, den du verbessern möchtest...'
                : 'Beschreibe kurz, was du gemacht hast (z.B. "Bug in der Login-Funktion behoben")...'
            }
            rows={4}
          />
        </div>

        {mode === 'detailed' && (
          <div className="form-group">
            <label htmlFor="context">Zusätzlicher Kontext (optional):</label>
            <textarea
              id="context"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Zusätzliche Informationen, die für den Bericht relevant sind..."
              rows={2}
            />
          </div>
        )}
      </div>

      <div className="action-buttons">
        <button 
          onClick={handleGenerate} 
          disabled={isLoading || !description.trim()}
          className="generate-btn"
        >
          {isLoading ? '🔄 Generiere...' : '✨ Berichtsheft-Text generieren'}
        </button>
        <button onClick={handleClear} className="clear-btn">
          🗑️ Löschen
        </button>
      </div>

      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}

      {generatedText && (
        <div className="result-section">
          <div className="result-header">
            <h4>📝 Generierter Berichtsheft-Text:</h4>
            <button onClick={handleCopy} className="copy-btn">
              📋 Kopieren
            </button>
          </div>
          <div className="result-content">
            <div className="generated-text">
              {generatedText.split('\n').map((line, index) => (
                <div key={index} className="text-line">
                  {line}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BerichtsheftGenerator;
