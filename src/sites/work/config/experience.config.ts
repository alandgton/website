export interface ExperienceCourse {
  code: string;
  title: string;
}

export interface ExperienceEntry {
  id: string;
  company: string;
  role: string;
  employmentType: 'Full-time' | 'Part-time' | 'Internship';
  dateRange: string;
  location: string;
  isCurrent?: boolean;
  focus?: string;
  courses?: ExperienceCourse[];
}

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
    location: 'New York, NY',
    isCurrent: true,
    focus: 'Fixed Income & Macro',
  },
  {
    id: 'meta',
    company: 'Meta',
    role: 'Production Engineer',
    employmentType: 'Full-time',
    dateRange: 'Sep 2020 – Oct 2023',
    location: 'New York, NY',
    focus: 'Messaging Infrastructure',
  },
  {
    id: 'uc-berkeley',
    company: 'UC Berkeley College of Engineering',
    role: 'Undergraduate Student Instructor',
    employmentType: 'Part-time',
    dateRange: 'Jan 2018 – May 2020',
    location: 'Berkeley, CA',
    courses: [
      { code: 'CS162', title: 'Operating Systems & Systems Programming' },
      { code: 'CS61B', title: 'Data Structures & Algorithms' },
      { code: 'EE16A', title: 'Linear Algebra & RC Circuits' },
    ],
  },
  {
    id: 'facebook',
    company: 'Facebook',
    role: 'Production Engineer',
    employmentType: 'Internship',
    dateRange: 'May 2019 – Aug 2019',
    location: 'Menlo Park, CA',
    focus: 'Instagram Core Infrastructure',
  },
  {
    id: 'aws',
    company: 'Amazon Web Services',
    role: 'Software Development Engineer',
    employmentType: 'Internship',
    dateRange: 'May 2018 – Aug 2018',
    location: 'Seattle, WA',
    focus: 'Elastic Compute Cloud (EC2) Networking',
  },
  {
    id: 'nasa-jpl',
    company: 'NASA Jet Propulsion Laboratory',
    role: 'Undergraduate Engineering',
    employmentType: 'Internship',
    dateRange: 'May 2017 – Aug 2017',
    location: 'Pasadena, CA',
    focus: 'Component Engineering & Assurance Office',
  },
];
