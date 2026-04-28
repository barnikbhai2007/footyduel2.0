# **App Name**: FootyDuel

## Core Features:

- Google Account Login: Secure authentication for users to sign in and identify themselves using their Google accounts.
- Real-time Room Creation & Join: Players can create 1v1 game rooms with unique Firebase-generated codes, and others can join instantly using these codes.
- Dynamic Lobby Configuration: The room creator can adjust game settings like player health and game versions, while the joining player can view but not modify them.
- AI-Powered Hint Generation: An AI tool generates a series of hints about a specific footballer, gradually increasing in specificity and difficulty to aid players in guessing.
- Interactive Guessing & Scoring: Players can input their guesses with a timer, receive instant feedback (+10 for correct, -10 for wrong, 0 for no answer), and see opponent's guesses.
- Health System & Round Progression: Players start with customizable health, which depletes based on guessing performance; includes countdowns for game start and new rounds, and pop-up notifications for events.
- Animated Result & Card Display: After each round, a full-screen animation plays, revealing the correct footballer along with a detailed player card, current scores, and health statuses, utilizing 'footballer.json' data.

## Style Guidelines:

- The primary interactive color is a vibrant orange (#E65C15), chosen to convey energy and competition.
- The background features a dark, warm grey-brown (#251C19), providing a dramatic backdrop for the game interface.
- An energetic golden yellow (#F2C55E) serves as the accent color, highlighting key actions and information.
- Headlines and prominent UI elements utilize the 'Poppins' sans-serif font for a modern and precise aesthetic, suitable for clear game-related text.
- Body text and game hints will use the 'Inter' sans-serif font, chosen for its excellent legibility and neutral, objective appearance, ideal for prolonged reading.
- Use clear, stylized icons related to football and general game mechanics; implement six distinct emote icons for in-game communication, suitable for a mobile-first interface.
- Implement a clean, mobile-first responsive layout with clearly defined game zones for hints, guessing input, score displays, and notifications, focusing on intuitive interaction for one-handed use.
- Integrate dynamic animations for countdowns, seamless transitions between game states, expressive result reveals in the style of FC Mobile, and subtle feedback for interactive elements.