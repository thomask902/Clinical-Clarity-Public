# Clinical-Clarity

## Management Engineering Class of 2025 Capstone Project

### Saleh Bhatti, Abhinav Sondhi, Matt Erxleben, John Kachura, Thomas Kleinknecht

## Project Overview
Project Demo Video: https://www.youtube.com/watch?v=SuVnd9oylfo
OSCE (Objective Structured Clinical Examination) exams are essential in medical education, yet traditional preparation methods like peer role-playing are often inconsistent and difficult to access on demand. Clinical Clarity addresses this by providing a repeatable, low-pressure environment for students to refine their skills.
Project Demo Video: https://www.youtube.com/watch?v=SuVnd9oylfo
## Key Features

Curated Scenarios: Users can select from various OSCE cases covering common patient symptoms and concerns.

AI Patient Simulation: Users interact with a virtual patient using voice or text, receiving contextual, in-character responses.

Structured Feedback: After each session, an AI evaluator provides a performance breakdown based on real clinical assessment criteria and scenario-specific checklists.

## Tech Stack

Frontend: React and Next.js (hosted on Vercel)

Backend: Python Flask (hosted on Render)

Database: Supabase (PostgreSQL) for user data and scenarios

AI/MLOps: Azure, GPT-4o, and Azure AI Speech

## System Architecture

Scenario Selection: User selects a case; metadata is retrieved from the database.

Interaction: User speech is processed via Speech-to-Text; GPT-4o generates a patient response, which is outputted as audio and text.

Evaluation: The simulation transcript is analyzed against OSCE criteria to provide personalized feedback.

## Validation

The platform was tested with 10 Canadian medical students and an expert clinician, achieving the following metrics:

Usability: 87% (UMUX Score)

Effectiveness: 8.8/10

Recommendation Likelihood: 8.4/10

## Future Roadmap

Scenario Library: Expanding the diversity and categorization of cases.

Speech Analysis: Adding evaluations for tone, pacing, and clarity.

Improved AI: Enhancing emotional range and enabling hands-free conversation.

Gamification: Implementing streaks, daily challenges, and achievements.
