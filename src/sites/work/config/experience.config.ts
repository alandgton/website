export type ExperienceRegion = 'nyc' | 'west';

export type ExperienceFilter = 'all' | ExperienceRegion;

export interface ExperienceCourse {
  code: string;
  title: string;
}

export interface ExperienceEntry {
  id: string;
  company: string;
  role: string;
  employmentType: 'Full-time' | 'Part-time';
  dateRange: string;
  location: string;
  region: ExperienceRegion;
  isCurrent?: boolean;
  focus?: string;
  courses?: ExperienceCourse[];
}

export const EXPERIENCE_FILTERS: { id: ExperienceFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'nyc', label: 'New York' },
  { id: 'west', label: 'West Coast' },
];

/**
 * Chronological experience entries ordered Present -> 2017.
 */
export const EXPERIENCE_ENTRIES: ExperienceEntry[] = [
  {
    id: 'citadel',
    company: 'Citadel',
    role: 'Software Engineer',
    employmentType: 'Full-time',
    dateRange: 'Oct 2023 – Present',
    location: 'New York, New York, United States · On-site',
    region: 'nyc',
    isCurrent: true,
    focus: 'Fixed Income & Macro',
  },
  {
    id: 'meta',
    company: 'Meta',
    role: 'Production Engineer',
    employmentType: 'Full-time',
    dateRange: 'Sep 2020 – Oct 2023',
    location: 'New York, New York, United States · On-site',
    region: 'nyc',
    focus: 'Messaging Infrastructure',
  },
  {
    id: 'uc-berkeley',
    company: 'UC Berkeley College of Engineering',
    role: 'Undergraduate Student Instructor',
    employmentType: 'Part-time',
    dateRange: 'Jan 2018 – May 2020',
    location: 'Berkeley, CA',
    region: 'west',
    courses: [
      { code: 'CS162', title: 'Operating Systems & Systems Programming' },
      { code: 'CS61B', title: 'Data Structures & Algorithms' },
      { code: 'EE16A', title: 'Linear Algebra & RC Circuits' },
    ],
  },
  {
    id: 'facebook',
    company: 'Facebook',
    role: 'Production Engineer Intern',
    employmentType: 'Full-time',
    dateRange: 'May 2019 – Aug 2019',
    location: 'Menlo Park, California',
    region: 'west',
    focus: 'Instagram Core Infrastructure',
  },
  {
    id: 'aws',
    company: 'Amazon Web Services (AWS)',
    role: 'Software Development Engineer Intern',
    employmentType: 'Full-time',
    dateRange: 'May 2018 – Aug 2018',
    location: 'Seattle, Washington',
    region: 'west',
    focus: 'Elastic Compute Cloud (EC2) Networking',
  },
  {
    id: 'nasa-jpl',
    company: 'NASA Jet Propulsion Laboratory',
    role: 'Undergraduate Engineering Intern',
    employmentType: 'Full-time',
    dateRange: 'May 2017 – Aug 2017',
    location: 'Pasadena, California',
    region: 'west',
    focus: 'Component Engineering & Assurance Office',
  },
];
