# Brew — Prototype

A high-fidelity interactive prototype for usability testing and UX research.

## About

This prototype simulates a mobile app for logging specialty coffee brewing sessions. It is built as a static web app (HTML, CSS, vanilla JS) to enable realistic task-based testing without requiring a native mobile build.

The design is based on a Figma design system and follows the visual tokens (color, typography, spacing, radius) defined there.

## Purpose

This prototype is intended exclusively for **UX research and usability testing**. It is not a production application. Features may be incomplete or simulated to support specific test scenarios.

It is deployed via GitHub Pages and linked to [Maze](https://maze.co) for moderated and unmoderated testing sessions.

## Key Flows Covered

- **New Preparation** — selecting a coffee, brew method, and parameters before starting
- **Timer** — starting a countdown, registering bloom and pour events
- **Review** — rating the result, adding notes, and saving the session
- **Detail** — viewing a saved preparation summary

## Stack

- Plain HTML + CSS + JavaScript (no frameworks)
- `localStorage` for session persistence within the same browser
- Deployed on GitHub Pages

## Design Reference

Figma file: [Proyecto Final](https://www.figma.com/design/0A0bO1e2axjv4hDLbLJZDt/Proyecto-Final)

## Notes for Testers

- The app runs entirely in the browser — no account or login is required
- Saved preparations persist only within the same browser session
- Some flows (e.g. café/method catalogs) use placeholder data
