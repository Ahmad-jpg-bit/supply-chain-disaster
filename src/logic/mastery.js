import { CHAPTERS } from '../data/chapters.js';

export class MasteryTracker {
    constructor() {
        // Initialize scores for each chapter concept
        this.scores = {};
        this.decisions = {};
        CHAPTERS.forEach(ch => {
            this.scores[ch.id] = 0;
            this.decisions[ch.id] = [];
        });
    }

    recordDecision(chapterId, conceptAlignment) {
        if (!this.scores.hasOwnProperty(chapterId)) return;

        let points = 0;
        switch (conceptAlignment) {
            case 'optimal':
                points = 25;
                break;
            case 'cautious':
                points = 10;
                break;
            case 'risky':
                points = -10;
                break;
        }

        this.scores[chapterId] += points;
        this.decisions[chapterId].push({ alignment: conceptAlignment, points });
    }

    getScore(chapterId) {
        return this.scores[chapterId] || 0;
    }

    isMastered(chapterId) {
        return this.getScore(chapterId) >= 60;
    }

    getChapterSummary(chapterId) {
        const chapter = CHAPTERS.find(ch => ch.id === chapterId);
        const score = this.getScore(chapterId);
        const decisions = this.decisions[chapterId] || [];
        const optimalCount = decisions.filter(d => d.alignment === 'optimal').length;
        const cautiousCount = decisions.filter(d => d.alignment === 'cautious').length;
        const riskyCount = decisions.filter(d => d.alignment === 'risky').length;

        return {
            chapterId,
            chapterTitle: chapter ? chapter.title : chapterId,
            score,
            maxScore: 100, // 4 turns * 25 points each
            mastered: score >= 60,
            decisions: { optimal: optimalCount, cautious: cautiousCount, risky: riskyCount }
        };
    }

    getAllSummaries() {
        return CHAPTERS.map(ch => this.getChapterSummary(ch.id));
    }

    getOverallScore() {
        const summaries = this.getAllSummaries();
        const totalScore = summaries.reduce((sum, s) => sum + s.score, 0);
        const maxTotal = summaries.reduce((sum, s) => sum + s.maxScore, 0);
        const masteredCount = summaries.filter(s => s.mastered).length;

        return {
            totalScore,
            maxTotal,
            percentage: Math.round((totalScore / maxTotal) * 100),
            masteredCount,
            totalConcepts: CHAPTERS.length
        };
    }
}
