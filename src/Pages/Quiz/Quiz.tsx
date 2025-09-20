import React, { useState } from 'react';
import { CheckCircle, XCircle, RotateCcw, Play, Trophy, Star } from 'lucide-react';
import styles from './Quiz.module.scss';

interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

const Quiz: React.FC = () => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [quizCompleted, setQuizCompleted] = useState(false);

  // Beispiel-Fragen für das Quiz
  const questions: Question[] = [
    {
      id: 1,
      question: "Was ist die Hauptstadt von Deutschland?",
      options: ["München", "Berlin", "Hamburg", "Köln"],
      correctAnswer: 1,
      explanation: "Berlin ist seit 1990 die Hauptstadt von Deutschland."
    },
    {
      id: 2,
      question: "Welche Programmiersprache wird hauptsächlich für Web-Entwicklung verwendet?",
      options: ["Python", "JavaScript", "C++", "Java"],
      correctAnswer: 1,
      explanation: "JavaScript ist die wichtigste Programmiersprache für Web-Entwicklung."
    },
    {
      id: 3,
      question: "Was bedeutet HTML?",
      options: ["HyperText Markup Language", "High Tech Modern Language", "Home Tool Markup Language", "Hyperlink and Text Markup Language"],
      correctAnswer: 0,
      explanation: "HTML steht für HyperText Markup Language."
    },
    {
      id: 4,
      question: "Welches ist das größte Organ des menschlichen Körpers?",
      options: ["Leber", "Haut", "Lunge", "Herz"],
      correctAnswer: 1,
      explanation: "Die Haut ist mit einer Fläche von etwa 2 Quadratmetern das größte Organ."
    },
    {
      id: 5,
      question: "In welchem Jahr wurde das Internet erfunden?",
      options: ["1969", "1975", "1980", "1990"],
      correctAnswer: 0,
      explanation: "Das ARPANET, der Vorläufer des Internets, wurde 1969 gestartet."
    }
  ];

  const handleAnswerSelect = (answerIndex: number) => {
    if (showResult) return;
    setSelectedAnswer(answerIndex);
  };

  const handleSubmitAnswer = () => {
    if (selectedAnswer === null) return;
    
    setShowResult(true);
    
    if (selectedAnswer === questions[currentQuestion].correctAnswer) {
      setScore(prev => prev + 1);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    } else {
      setQuizCompleted(true);
    }
  };

  const handleRestartQuiz = () => {
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setScore(0);
    setQuizCompleted(false);
  };

  const getScoreColor = () => {
    const percentage = (score / questions.length) * 100;
    if (percentage >= 80) return '#4ade80'; // Grün
    if (percentage >= 60) return '#fbbf24'; // Gelb
    return '#f87171'; // Rot
  };

  const getScoreMessage = () => {
    const percentage = (score / questions.length) * 100;
    if (percentage >= 80) return 'Ausgezeichnet!';
    if (percentage >= 60) return 'Gut gemacht!';
    return 'Versuche es nochmal!';
  };

  if (quizCompleted) {
    return (
      <div className={styles.quiz}>
        <div className={styles.container}>
          <div className={styles.completionScreen}>
            <div className={styles.trophyIcon}>
              <Trophy size={80} />
            </div>
            <h1>Quiz abgeschlossen!</h1>
            <div className={styles.scoreDisplay}>
              <div className={styles.scoreCircle} style={{ borderColor: getScoreColor() }}>
                <span className={styles.scoreNumber}>{score}</span>
                <span className={styles.scoreTotal}>/{questions.length}</span>
              </div>
              <p className={styles.scoreMessage} style={{ color: getScoreColor() }}>
                {getScoreMessage()}
              </p>
            </div>
            <div className={styles.scoreDetails}>
              <p>Du hast {score} von {questions.length} Fragen richtig beantwortet.</p>
              <p>Das entspricht {Math.round((score / questions.length) * 100)}%.</p>
            </div>
            <button 
              className={styles.restartButton}
              onClick={handleRestartQuiz}
            >
              <RotateCcw size={20} />
              Quiz neu starten
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.quiz}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>Quiz</h1>
          <p>Lerne für Klausren oder Tests</p>
        </div>

        <div className={styles.quizContainer}>
          {/* Progress Bar */}
          <div className={styles.progressSection}>
            <div className={styles.progressInfo}>
              <span>Frage {currentQuestion + 1} von {questions.length}</span>
              <span className={styles.score}>Punktzahl: {score}</span>
            </div>
            <div className={styles.progressBar}>
              <div 
                className={styles.progressFill}
                style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Question */}
          <div className={styles.questionSection}>
            <h2 className={styles.question}>
              {questions[currentQuestion].question}
            </h2>
          </div>

          {/* Answer Options */}
          <div className={styles.answersSection}>
            {questions[currentQuestion].options.map((option, index) => {
              const isSelected = selectedAnswer === index;
              const isCorrect = index === questions[currentQuestion].correctAnswer;
              const isWrong = showResult && isSelected && !isCorrect;
              
              return (
                <button
                  key={index}
                  className={`${styles.answerOption} ${
                    isSelected ? styles.selected : ''
                  } ${
                    showResult && isCorrect ? styles.correct : ''
                  } ${
                    isWrong ? styles.wrong : ''
                  }`}
                  onClick={() => handleAnswerSelect(index)}
                  disabled={showResult}
                >
                  <div className={styles.optionContent}>
                    <span className={styles.optionLetter}>
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span className={styles.optionText}>{option}</span>
                    {showResult && isCorrect && (
                      <CheckCircle className={styles.resultIcon} size={20} />
                    )}
                    {isWrong && (
                      <XCircle className={styles.resultIcon} size={20} />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Explanation */}
          {showResult && questions[currentQuestion].explanation && (
            <div className={styles.explanation}>
              <h4>Erklärung:</h4>
              <p>{questions[currentQuestion].explanation}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className={styles.actionButtons}>
            {!showResult ? (
              <button
                className={`${styles.submitButton} ${
                  selectedAnswer === null ? styles.disabled : ''
                }`}
                onClick={handleSubmitAnswer}
                disabled={selectedAnswer === null}
              >
                <Play size={20} />
                Antwort abgeben
              </button>
            ) : (
              <button
                className={styles.nextButton}
                onClick={handleNextQuestion}
              >
                {currentQuestion < questions.length - 1 ? 'Nächste Frage' : 'Quiz beenden'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Quiz;
