# UML Studio

Fullstack-ready UML whiteboard for designing Java classes and generating starter code.

## What is included

- React + Vite frontend.
- React Flow whiteboard with draggable UML Class, Abstract Class, Interface, and Enum nodes.
- Relation drawing for association, aggregation, composition, inheritance, implementation, and dependency.
- Visual-to-Java code generation.
- Simple text/code-to-visual import.
- Supabase project storage with a browser local-storage fallback.
- Spring Boot scaffold in `backend/` for moving persistence/code-generation behind an API.

## Run the frontend

```bash
npm install
npm run dev
```

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Copy `.env.example` to `.env`.
4. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. Restart the Vite dev server.

Without env vars the app still works and stores the latest project in browser storage.


