# Sales Enablement 360 Training Module

This folder contains the starter specification and structured data for building a software application around the Sales Enablement 360 onboarding program.

The source outline is organized as **Topics / Modules** with **Subtopics** underneath each module. Each subtopic is designed to support training resources such as tools, SOPs, videos, flowcharts, checklists, quizzes, practice assignments, completion tracking, and manager sign-off.

## Goal

Build a lightweight training management app for sales onboarding where admins can:

- Create and manage training topics/modules
- Add subtopics under each topic
- Attach training links for each subtopic
- Assign owners/trainers
- Track rep completion
- Require manager sign-off
- Add quizzes, checklists, videos, SOPs, and practice assignments
- View onboarding progress by rep, topic, and subtopic

## Suggested MVP Screens

1. **Admin Training Builder**
   - Create/edit topics
   - Create/edit subtopics
   - Add links and resources
   - Set estimated completion time
   - Assign owner/trainer

2. **Rep Training Dashboard**
   - View assigned training modules
   - Open training links
   - Mark items complete
   - See progress by module

3. **Manager Review Dashboard**
   - View completion by rep
   - Review practice assignments
   - Sign off on completed subtopics

4. **Resource Library**
   - Search/filter all tools, SOPs, videos, checklists, flowcharts, quizzes, and policies

## Files

- `training_catalog.json` - structured starter data for the onboarding program
- `schema.sql` - suggested relational database schema
- `codex_build_prompt.md` - prompt/instructions for Codex to build the app

## Recommended Tech Stack

A simple first build could use:

- Next.js or React for the front end
- Supabase or PostgreSQL for the database
- Auth with roles: Admin, Trainer, Rep, Manager
- Storage of external links rather than uploaded files for MVP

## Data Model Summary

- Topic / Module
- Subtopic
- Training Resource Links
- Practice Assignment
- Owner / Trainer
- Rep Completion
- Manager Sign-Off
- Notes
