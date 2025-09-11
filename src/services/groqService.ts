import { config, loadConfig } from '../utils/config';

interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GroqResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

class GroqService {
  private baseUrl = 'https://api.groq.com/openai/v1';

  private getApiKey(): string {
    const apiKey = config.groq_key || '';
    if (!apiKey) {
      console.warn('⚠️ Groq API key not found in config');
    }
    return apiKey;
  }

  private async makeRequest(messages: GroqMessage[]): Promise<string> {
    // Ensure config is loaded
    await loadConfig();
    
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('Groq API key not configured');
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant', // Groq's current model
          messages: messages,
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        throw new Error(`Groq API request failed: ${response.status} ${response.statusText}`);
      }

      const data: GroqResponse = await response.json();
      return data.choices[0]?.message?.content || 'Keine Antwort erhalten';
    } catch (error) {
      console.error('❌ Groq API error:', error);
      throw new Error(`Groq API Fehler: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
    }
  }

  async generateBerichtsheftText(description: string): Promise<string> {
    const messages: GroqMessage[] = [
      {
        role: 'system',
        content: `Du bist ein hilfreicher Assistent, der Azubis beim Schreiben von natürlichen Berichtsheft-Einträgen hilft. 
        
        Deine Aufgabe:
        - Schreibe maximal zwei einfache Stichpunkte basierend auf der Beschreibung
        - Die Stichpunkte sollen natürlich und menschlich klingen, wie ein echter Schüler schreibt
        - Verwende konkrete Details und persönliche Erfahrungen
        - Schreibe in der Vergangenheit aus Sicht eines Azubis
        - Verwende natürliche, direkte Sprache ohne "ich habe" oder "habe ich"
        - Beginne mit Verben oder direkten Beschreibungen der Tätigkeit
        - Verwende keinen Punkt am Ende der Stichpunkte
        - Gib nur die zwei Stichpunkte im Format zurück:
          - <1.Stichpunkt>
          - <2.Stichpunkt>
        
        Beispiel:
        Input: "Bug in der Login-Funktion behoben"
        Output: 
        - Login-Funktion analysiert und Fehlerquelle identifiziert
        - Code-Änderungen implementiert und erfolgreich getestet`
      },
      {
        role: 'user',
        content: `Beschreibung: ${description}`
      }
    ];

    return await this.makeRequest(messages);
  }

  async generateDetailedBerichtsheftText(description: string, context?: string): Promise<string> {
    const messages: GroqMessage[] = [
      {
        role: 'system',
        content: `Du bist ein hilfreicher Assistent, der Azubis beim Schreiben von natürlichen, menschlichen Berichtsheft-Einträgen hilft.
        
        Schreibe einen Berichtsheft-Eintrag, als würde ein echter Schüler über seine Woche berichten. Der Bericht sollte:
        - Natürlich und persönlich klingen, wie ein echter Schüler schreibt
        - Konkrete Daten, Zeiten und Details verwenden (z.B. "war am Dienstag krank", "habe heute die Aufgabe gemacht")
        - Persönliche Erfahrungen und Gefühle einbeziehen
        - Spezifische Details über Krankheit, Abwesenheiten, Fristen, etc. erwähnen
        - Wie ein echter Bericht klingen, nicht wie ein Roboter
        - 2-3 Absätze umfassen
        - In der ersten Person geschrieben sein, aber natürlich und menschlich
        
        Beispiele für natürliche Formulierungen:
        - "War am Montag krank und konnte nicht zur Schule"
        - "Habe die Aufgabe heute gemacht, weil sie morgen fällig ist"
        - "War sonst die ganze Woche in der Schule und habe normal am Unterricht teilgenommen"
        - "Habe am Wochenende Zeit gehabt, deshalb die Hausaufgaben erledigt"
        
        Format:
        ## Tätigkeit: [Kurze Überschrift]
        
        [Natürliche Beschreibung der Woche mit konkreten Details und persönlichen Erfahrungen]
        
        [Was wurde gelernt und wie war die Woche - persönlich und authentisch]`
      },
      {
        role: 'user',
        content: `Beschreibung: ${description}${context ? `\n\nKontext: ${context}` : ''}`
      }
    ];

    return await this.makeRequest(messages);
  }

  async improveBerichtsheftText(existingText: string): Promise<string> {
    const messages: GroqMessage[] = [
      {
        role: 'system',
        content: `Du bist ein Experte für Berichtsheft-Einträge. Verbessere den folgenden Berichtsheft-Text, damit er:
        - Natürlich und menschlich klingt, wie ein echter Schüler schreibt
        - Konkrete Daten, Zeiten und persönliche Details enthält
        - Persönliche Erfahrungen und Gefühle einbezieht
        - Spezifische Details über Krankheit, Abwesenheiten, Fristen, etc. erwähnt
        - Wie ein echter Bericht klingt, nicht wie ein Roboter
        - Natürlich in der ersten Person geschrieben ist
        - Persönlich und authentisch formuliert ist
        
        Beispiele für natürliche Verbesserungen:
        - "War am Montag krank und konnte nicht zur Schule"
        - "Habe die Aufgabe heute gemacht, weil sie morgen fällig ist"
        - "War sonst die ganze Woche in der Schule und habe normal am Unterricht teilgenommen"
        - "Habe am Wochenende Zeit gehabt, deshalb die Hausaufgaben erledigt"
        
        Behalte den ursprünglichen Inhalt bei, aber mache ihn natürlicher und persönlicher.`
      },
      {
        role: 'user',
        content: `Bitte verbessere diesen Berichtsheft-Text:\n\n${existingText}`
      }
    ];

    return await this.makeRequest(messages);
  }

  async generateSummaryFromTimetable(timetableData: any): Promise<string> {
    const messages: GroqMessage[] = [
      {
        role: 'system',
        content: `Du bist ein Experte für Berichtsheft-Einträge. Erstelle einen Berichtsheft-Eintrag basierend auf den Stundenplan-Daten.
        
        Der Bericht sollte:
        - Natürlich und menschlich klingen, wie ein echter Schüler über seine Woche berichtet
        - Konkrete Daten, Zeiten und persönliche Details verwenden
        - Persönliche Erfahrungen und Gefühle einbeziehen
        - Spezifische Details über Krankheit, Abwesenheiten, Fristen, etc. erwähnen
        - Wie ein echter Bericht klingen, nicht wie ein Roboter
        - Die wichtigsten Aktivitäten des Tages/der Woche zusammenfassen
        - Zeigen, was der Azubi gelernt hat
        - Natürlich in der ersten Person geschrieben sein
        
        Beispiele für natürliche Formulierungen:
        - "War am Montag krank und konnte nicht zur Schule"
        - "Habe die Aufgabe heute gemacht, weil sie morgen fällig ist"
        - "War sonst die ganze Woche in der Schule und habe normal am Unterricht teilgenommen"
        - "Habe am Wochenende Zeit gehabt, deshalb die Hausaufgaben erledigt"
        
        Format:
        ## Tages-/Wochenbericht
        
        [Natürliche Beschreibung der Woche mit konkreten Details und persönlichen Erfahrungen]
        
        [Was wurde gelernt und wie war die Woche - persönlich und authentisch]`
      },
      {
        role: 'user',
        content: `Stundenplan-Daten: ${JSON.stringify(timetableData, null, 2)}`
      }
    ];

    return await this.makeRequest(messages);
  }
}

// Export singleton instance
export const groqService = new GroqService();

// Export individual functions for easy use
export const generateBerichtsheftText = (description: string) => 
  groqService.generateBerichtsheftText(description);

export const generateDetailedBerichtsheftText = (description: string, context?: string) => 
  groqService.generateDetailedBerichtsheftText(description, context);

export const improveBerichtsheftText = (existingText: string) => 
  groqService.improveBerichtsheftText(existingText);

export const generateSummaryFromTimetable = (timetableData: any) => 
  groqService.generateSummaryFromTimetable(timetableData);
