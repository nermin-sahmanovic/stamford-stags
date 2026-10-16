// About page copy. Edit freely: it's plain text, no markup.
// Lines marked "TODO captain" describe league rules or team policy that the
// captain should confirm before launch (CLAUDE.md: don't invent league rules).

export const mission =
  "The Stamford Stags are a USTA adult league team for players who want competitive match play with the feel of a club: a steady group, organized match days and a captain who keeps everyone informed.";

export const league = {
  title: "The league",
  points: [
    "We play in the USTA Adult League, organized by NTRP level.", // TODO captain: confirm age group and level
    "Each match has 2 singles and 3 doubles lines.", // Matches the current season setup; TODO captain: confirm
    "Your NTRP rating must be at or below the team's level to play.", // TODO captain: confirm eligibility rules
    "Scores and standings are entered by the captain; the USTA site is the official record.",
  ],
};

export const locations = [
  {
    name: "Stamford Tennis Center",
    note: "Home courts for most of our home matches.",
  },
  {
    name: "Darien Indoor Tennis",
    note: "Regular away venue in the fall season.",
  },
];

export const culture = {
  title: "Team culture",
  points: [
    "Competitive on court, friendly off it.",
    "Everyone gets match time across the season.", // TODO captain: confirm lineup policy
    "We practice together and celebrate wins (and losses) together.",
  ],
};

export const expectations = {
  title: "What we expect",
  points: [
    "Keep your availability up to date for every match.",
    "Confirm your lineup spot as soon as it's posted.",
    "Show up 15 minutes before match time, ready to warm up.", // TODO captain: confirm arrival time
    "Keep your USTA membership current for the whole season.",
  ],
};
