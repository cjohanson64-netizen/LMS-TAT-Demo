# 📘 TAT LMS — Semantic Learning Management System

A full-stack Learning Management System built with a Java backend and React frontend, powered by **TryAngleTree (TAT)** to deliver semantic, behavior-driven UI.

---

## 🚀 Overview

This project explores a different approach to application architecture:

> Instead of sending raw data to the frontend, the backend generates **semantic projections** that describe *what the UI means* and *what users can do*.

The frontend then renders directly from that semantic layer.

---

## 🧠 Core Idea

Traditional apps:

```text
Backend → Data → Frontend → Logic → UI

TAT-driven apps:

Backend → Semantic Graph (TAT) → Projection → UI

This shifts responsibility from frontend logic to backend semantics.

🧩 Key Features
✅ Course, assignment, and submission management
✅ Role-based access (Admin, Teacher, Student)
✅ Assignment status system (No Submissions, Needs Grading, Graded)
✅ Action-driven UI (nextAction determines behavior)
✅ Semantic projections via TAT
✅ Dynamic UI rendering in React
🔥 What Makes This Different
1. Semantic UI Layer (TAT)

Instead of computing UI state in React, the backend defines:

{
  "status": { "code": "needs_grading", "label": "Needs Grading" },
  "nextAction": { "code": "grade_submissions", "label": "Grade Submissions" }
}

The frontend simply renders and reacts.

2. Behavior Comes from Data

Buttons are not hardcoded:

<button>{assignment.nextAction.label}</button>

The backend decides:

What action exists
When it’s available
What it should do
3. Reduced Frontend Complexity
No duplicated business logic
No manual status computation
UI becomes a pure rendering layer
🏗️ Tech Stack
Backend
Java (Spring Boot)
REST APIs
TAT (TryAngleTree DSL + runtime)
Frontend
React
TypeScript
Component-based UI
Semantic rendering from projections
📂 Project Structure
server/
  ├── controllers/
  ├── services/
  ├── tat/
  │     ├── builders/
  │     ├── projections/
  │     └── runtime/
  └── models/

client/
  ├── features/
  │     ├── assignments/
  │     ├── teacher/
  │     └── submissions/
  ├── api/
  └── components/
⚙️ Running the Project
Backend
cd server
./mvnw spring-boot:run
Frontend
cd client
npm install
npm run dev
🔑 Example Flow
Teacher creates assignment
Student submits work
Backend generates TAT graph
Projection computes:
{
  "status": "needs_grading",
  "nextAction": "grade_submissions"
}
UI updates automatically
🧪 Future Directions
🔄 Real-time projection updates
🧠 Fully TAT-driven navigation
📊 Analytics via graph traversal
🎮 Extending TAT to other domains (RPG, education tools, etc.)
👤 Author

Carl Johanson  
[LinkedIn](https://www.linkedin.com/in/carlbiggersjohanson/)  
[Portfolio](https://my-portfolio-ashy-sigma-26.vercel.app/)

💡 Final Thought

This project is an exploration of what happens when:

UI becomes a projection of meaning, not just data.# LMS-TAT-Demo
