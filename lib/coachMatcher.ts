export interface Coach {
  id: string;
  name: string;
  email: string;
  phone: string;
  available_days: string[];        // ["Mon", "Tue", "Wed", ...]
  available_time_slots: string[];  // ["9 AM - 12 PM", "3 PM - 6 PM"]
  current_students: number;
  rating: number;                  // 0–5
}

export interface Lead {
  name: string;
  email: string;
  available_days: string[];        // ["Mon", "Wed"]
  available_time: string;          // "3 PM - 6 PM"
}

// Case 1: Perfect match — single coach with matching days + time
//   Lead: Mon/Wed, 3 PM - 6 PM
//   Coach1: Mon/Wed, [3 PM - 6 PM], 5 students, 4.8 rating
//   → Returns Coach1

// Case 2: Multiple coaches match — fewest students wins; rating breaks ties
//   Lead: Mon, 3 PM - 6 PM
//   Coach1: Mon, [3 PM - 6 PM], 5 students, 4.8 rating
//   Coach2: Mon, [3 PM - 6 PM], 2 students, 4.5 rating
//   → Returns Coach2 (2 < 5 students)

// Case 3: No match — no coach covers lead's day+time combination
//   Lead: Sat, 9 AM - 12 PM
//   No coaches available Saturday mornings
//   → Returns null

export function findBestCoach(lead: Lead, coaches: Coach[]): Coach | null {
  return (
    coaches
      .filter(coach =>
        lead.available_days.some(day => coach.available_days.includes(day))
      )
      .filter(coach =>
        coach.available_time_slots.includes(lead.available_time)
      )
      .sort((a, b) => {
        if (a.current_students !== b.current_students) {
          return a.current_students - b.current_students;
        }
        return b.rating - a.rating;
      })[0] ?? null
  );
}
