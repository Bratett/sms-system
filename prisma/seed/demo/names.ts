// Ghanaian name pools used to generate realistic demo students, guardians
// and staff. Spread across major ethnic groups so the dataset feels
// representative rather than Akan-only. Each array is 40-60 entries so
// a 200-student seed has reasonable variety without duplicates.

export const MALE_FIRST = [
  "Kwame", "Kofi", "Kwabena", "Kojo", "Yaw", "Kwaku", "Kwasi", "Kwadwo",
  "Akwasi", "Akwesi", "Emmanuel", "Isaac", "Michael", "Daniel", "Samuel",
  "Joshua", "Ebenezer", "Nana", "Prince", "Eric", "Francis", "Solomon",
  "Abraham", "Joseph", "Mensah", "Kwesi", "Richard", "Stephen", "Peter",
  "Paul", "John", "James", "Gabriel", "Isaac", "Ibrahim", "Abdul",
  "Mustapha", "Yusif", "Anas", "Musah", "Sule", "Adamu", "Salia",
  "Edem", "Senam", "Mawuli", "Komla", "Dzifa", "Elvis", "Benjamin",
];

export const FEMALE_FIRST = [
  "Ama", "Adwoa", "Afua", "Akosua", "Abena", "Akua", "Yaa", "Adjoa",
  "Grace", "Mercy", "Faith", "Esther", "Rebecca", "Hannah", "Rachel",
  "Sarah", "Mary", "Ruth", "Comfort", "Gifty", "Priscilla", "Cynthia",
  "Linda", "Beatrice", "Josephine", "Joyce", "Lydia", "Felicia", "Vivian",
  "Mavis", "Naa", "Nana Ama", "Efua", "Adjeley", "Esi", "Maa", "Ewura",
  "Fatimah", "Aisha", "Salma", "Hawa", "Rahma", "Zainab", "Sakinah",
  "Selasi", "Mawunyo", "Senanu", "Dela", "Elorm", "Praise", "Edith",
];

export const SURNAMES = [
  "Mensah", "Osei", "Owusu", "Asante", "Boateng", "Appiah", "Addo",
  "Ofori", "Amoako", "Bonsu", "Agyeman", "Poku", "Yeboah", "Asamoah",
  "Obeng", "Nkrumah", "Acheampong", "Oppong", "Baidoo", "Quaye",
  "Tetteh", "Nettey", "Laryea", "Addy", "Ankrah", "Sowah", "Lartey",
  "Lamptey", "Odoi", "Abbey", "Dodoo", "Dodoo", "Annan", "Ofosu",
  "Sarpong", "Darko", "Gyasi", "Adjei", "Ntim", "Gyamfi", "Frimpong",
  "Danso", "Wiafe", "Kumi", "Koranteng", "Kyei", "Antwi", "Bediako",
  "Akoto", "Amponsah", "Asiedu", "Ofei", "Dadzie", "Mireku",
  // Ewe / Volta
  "Agbeko", "Agbodeka", "Ahiable", "Amemasor", "Dogbe", "Kudoto", "Adzato",
  // Ga / Dangme
  "Adjei", "Quartey", "Boye", "Tagoe", "Nii", "Adjin",
  // Dagomba / Northern
  "Iddrisu", "Alhassan", "Sulemana", "Baba", "Gariba", "Mahama",
];

export const STAFF_PROFESSIONAL = [
  { first: "Dr. Kwesi", last: "Boadu", role: "headmaster" },
  { first: "Mrs. Abena", last: "Mensah", role: "assistant_headmaster_academic" },
  { first: "Mr. Joseph", last: "Owusu", role: "assistant_headmaster_admin" },
  { first: "Mrs. Grace", last: "Acheampong", role: "bursar" },
  { first: "Mr. Daniel", last: "Agyemang", role: "house_master" },
  { first: "Mrs. Vivian", last: "Sarpong", role: "house_master" },
  { first: "Mr. Solomon", last: "Addo", role: "teacher" },
  { first: "Mrs. Hannah", last: "Appiah", role: "teacher" },
  { first: "Mr. Isaac", last: "Asante", role: "teacher" },
  { first: "Mrs. Ruth", last: "Baidoo", role: "teacher" },
  { first: "Mr. Samuel", last: "Poku", role: "teacher" },
  { first: "Mr. Eric", last: "Ntim", role: "teacher" },
  { first: "Mrs. Linda", last: "Frimpong", role: "teacher" },
  { first: "Mrs. Beatrice", last: "Kyei", role: "teacher" },
  { first: "Mr. Stephen", last: "Antwi", role: "teacher" },
  { first: "Mr. Michael", last: "Obeng", role: "teacher" },
  { first: "Mrs. Gifty", last: "Danso", role: "teacher" },
  { first: "Mr. Mustapha", last: "Iddrisu", role: "teacher" },
];

export const GUARDIAN_RELATIONS = ["FATHER", "MOTHER", "GUARDIAN", "UNCLE", "AUNT"] as const;

export function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** Seeded PRNG so reruns produce an identical dataset. */
export function makeRng(seed = 42) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
