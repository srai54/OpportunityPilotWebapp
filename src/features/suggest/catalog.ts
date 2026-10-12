/**
 * Known skills and roles, offered as suggestions while typing. Free text is always allowed: this list only saves typing and
 * keeps spelling consistent (so a skill matches what job postings actually say).
 */

export const SKILLS: string[] = [
  // Languages
  'C#', '.NET', 'ASP.NET Core', 'F#', 'VB.NET', 'Java', 'Kotlin', 'Scala', 'Python', 'JavaScript', 'TypeScript', 'Go', 'Rust', 'C++', 'C', 'Swift',
  'Objective-C', 'PHP', 'Ruby', 'Perl', 'R', 'MATLAB', 'Dart', 'Elixir', 'Haskell', 'Clojure', 'Lua', 'Bash', 'PowerShell', 'SQL', 'T-SQL', 'PL/SQL',
  // Web front end
  'React', 'Next.js', 'Redux', 'Angular', 'Vue.js', 'Nuxt', 'Svelte', 'HTML', 'CSS', 'Sass', 'Tailwind CSS', 'Bootstrap', 'jQuery', 'Webpack', 'Vite',
  'GraphQL', 'REST APIs', 'WebSockets', 'Accessibility (WCAG)', 'Responsive design', 'Progressive web apps', 'Storybook', 'Jest', 'Cypress', 'Playwright',
  // Back end & frameworks
  'Node.js', 'Express', 'NestJS', 'Spring Boot', 'Django', 'Flask', 'FastAPI', 'Laravel', 'Ruby on Rails', 'Entity Framework', 'Blazor', 'SignalR',
  'gRPC', 'Microservices', 'Domain-driven design', 'Clean architecture', 'Event-driven architecture', 'Message queues', 'RabbitMQ', 'Kafka', 'Redis',
  // Data stores
  'PostgreSQL', 'MySQL', 'SQL Server', 'Oracle', 'MongoDB', 'Cassandra', 'DynamoDB', 'Elasticsearch', 'Neo4j', 'SQLite', 'Snowflake', 'BigQuery', 'Redshift',
  // Cloud & DevOps
  'Azure', 'AWS', 'Google Cloud', 'Docker', 'Kubernetes', 'Terraform', 'Ansible', 'Helm', 'CI/CD', 'GitHub Actions', 'Azure DevOps', 'Jenkins', 'GitLab CI',
  'Linux', 'Windows Server', 'Networking', 'Nginx', 'Observability', 'Prometheus', 'Grafana', 'Datadog', 'Serverless', 'Azure Functions', 'AWS Lambda',
  'Infrastructure as code', 'Site reliability engineering', 'Cloud migration', 'Cost optimisation',
  // Data & AI
  'Machine learning', 'Deep learning', 'NLP', 'Computer vision', 'Generative AI', 'LLMs', 'Prompt engineering', 'RAG', 'PyTorch', 'TensorFlow', 'scikit-learn',
  'Pandas', 'NumPy', 'Spark', 'Databricks', 'Airflow', 'dbt', 'ETL', 'Data modelling', 'Data warehousing', 'Data engineering', 'Data analysis', 'Statistics',
  'A/B testing', 'Power BI', 'Tableau', 'Looker', 'Excel', 'Google Sheets', 'MLOps', 'Data governance',
  // Mobile & other engineering
  'Android', 'iOS', 'React Native', 'Flutter', 'Xamarin', 'MAUI', 'Unity', 'Embedded systems', 'IoT', 'Firmware', 'Game development', 'Blockchain', 'Solidity',
  // Quality & security
  'Test automation', 'Selenium', 'Unit testing', 'TDD', 'Performance testing', 'Manual testing', 'QA', 'Cybersecurity', 'Penetration testing', 'OWASP',
  'Identity and access management', 'OAuth', 'SSO', 'Zero trust', 'Compliance', 'ISO 27001', 'SOC 2', 'GDPR',
  // Product, design, delivery
  'Product management', 'Product strategy', 'Roadmapping', 'User research', 'UX design', 'UI design', 'Figma', 'Prototyping', 'Design systems', 'Wireframing',
  'Agile', 'Scrum', 'Kanban', 'Jira', 'Confluence', 'Project management', 'Program management', 'Stakeholder management', 'Business analysis', 'Requirements gathering',
  'Technical writing', 'Technical leadership', 'Mentoring', 'Code review', 'System design', 'Solution architecture', 'Enterprise architecture', 'API design',
  // Enterprise platforms
  'Dynamics 365', 'Power Platform', 'Power Automate', 'SharePoint', 'Salesforce', 'SAP', 'ServiceNow', 'Workday', 'NetSuite', 'HubSpot', 'Zendesk', 'Okta',
  'Microsoft 365', 'Office 365', 'Active Directory', 'Intune', 'ERP', 'CRM', 'Integration', 'MuleSoft', 'Boomi',
  // Sales & marketing
  'B2B sales', 'B2C sales', 'Enterprise sales', 'SaaS sales', 'Inside sales', 'Outbound sales', 'Cold calling', 'Cold emailing', 'Lead generation', 'Prospecting',
  'Account management', 'Account executive', 'Business development', 'Sales development', 'Pipeline management', 'Negotiation', 'Closing', 'Solution selling',
  'Consultative selling', 'Customer success', 'Customer support', 'Customer onboarding', 'Renewals', 'Upselling', 'Channel sales', 'Partnerships', 'Sales operations',
  'Sales enablement', 'Forecasting', 'CRM administration', 'LinkedIn Sales Navigator', 'Apollo', 'Outreach.io', 'Gong', 'RFP responses', 'Tenders', 'Proposal writing',
  'Digital marketing', 'Content marketing', 'SEO', 'SEM', 'Google Ads', 'Meta Ads', 'Email marketing', 'Marketing automation', 'Social media marketing', 'Copywriting',
  'Brand strategy', 'Growth marketing', 'Performance marketing', 'Analytics', 'Google Analytics', 'Market research', 'Public relations', 'Event marketing', 'Video editing',
  // Operations, finance, people
  'Operations management', 'Supply chain', 'Logistics', 'Procurement', 'Vendor management', 'Process improvement', 'Lean', 'Six Sigma', 'Budgeting', 'Financial modelling',
  'Accounting', 'Bookkeeping', 'Payroll', 'Tax', 'Auditing', 'FP&A', 'Treasury', 'Risk management', 'Recruiting', 'Talent acquisition', 'Sourcing', 'HR operations',
  'Employer branding', 'Onboarding', 'Learning and development', 'Compensation and benefits', 'Employee relations', 'Staffing', 'Contract negotiation', 'Legal research',
  // Soft skills
  'Communication', 'Leadership', 'Team management', 'Problem solving', 'Critical thinking', 'Presentation skills', 'Public speaking', 'Time management', 'Collaboration',
  'Customer focus', 'Adaptability', 'Analytical thinking', 'Facilitation', 'Coaching', 'Conflict resolution', 'Remote work', 'Cross-functional collaboration',
]

export const ROLES: string[] = [
  // Engineering
  '.NET developer', 'C# developer', 'Senior .NET developer', 'Full-stack developer', 'Frontend developer', 'Backend developer', 'React developer', 'Angular developer',
  'Vue developer', 'Node.js developer', 'Java developer', 'Python developer', 'Go developer', 'PHP developer', 'Ruby developer', 'Mobile developer', 'iOS developer',
  'Android developer', 'React Native developer', 'Flutter developer', 'Software engineer', 'Senior software engineer', 'Staff engineer', 'Principal engineer',
  'Engineering manager', 'Tech lead', 'Solutions architect', 'Software architect', 'Cloud architect', 'DevOps engineer', 'Site reliability engineer', 'Platform engineer',
  'Cloud engineer', 'Azure engineer', 'AWS engineer', 'Security engineer', 'Cybersecurity analyst', 'QA engineer', 'Test automation engineer', 'SDET', 'Embedded engineer',
  'Game developer', 'Blockchain developer', 'Integration developer', 'Dynamics 365 developer', 'Power Platform developer', 'Salesforce developer', 'SAP consultant',
  // Data & AI
  'Data engineer', 'Data scientist', 'Data analyst', 'Machine learning engineer', 'AI engineer', 'Business intelligence analyst', 'Analytics engineer', 'Database administrator',
  'Prompt engineer', 'MLOps engineer',
  // Product & design
  'Product manager', 'Senior product manager', 'Product owner', 'Scrum master', 'Project manager', 'Program manager', 'Business analyst', 'UX designer', 'UI designer',
  'Product designer', 'UX researcher', 'Technical writer', 'Technical program manager', 'Delivery manager',
  // Sales, marketing, customer
  'Sales representative', 'Sales development representative', 'Business development manager', 'Account executive', 'Account manager', 'Enterprise account executive',
  'Sales manager', 'Head of sales', 'Customer success manager', 'Sales engineer', 'Solutions consultant', 'Partnerships manager', 'Marketing manager', 'Digital marketing manager',
  'Content marketer', 'SEO specialist', 'Growth marketer', 'Brand manager', 'Social media manager', 'Customer support specialist', 'Technical support engineer', 'Pre-sales consultant',
  // Operations, finance, people
  'Operations manager', 'Supply chain analyst', 'Logistics coordinator', 'Procurement specialist', 'Financial analyst', 'Accountant', 'Finance manager', 'Payroll specialist',
  'HR manager', 'HR business partner', 'Recruiter', 'Technical recruiter', 'Talent acquisition specialist', 'Office manager', 'Executive assistant', 'Administrator',
  'Consultant', 'Management consultant', 'IT consultant', 'IT support', 'System administrator', 'Network engineer', 'Helpdesk analyst',
  // Other common roles
  'Customer service representative', 'Sales associate', 'Retail manager', 'Store manager', 'Warehouse supervisor', 'Graphic designer', 'Video editor', 'Content writer',
  'Copywriter', 'Data entry clerk', 'Receptionist', 'Legal counsel', 'Compliance officer', 'Risk analyst', 'Internal auditor', 'Tax consultant', 'Mechanical engineer',
  'Civil engineer', 'Electrical engineer', 'Operations analyst', 'Chief of staff', 'Founder', 'CTO', 'Head of engineering', 'Head of product', 'Head of marketing',
]

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * Up to `limit` matches for what is being typed, best first: whole-phrase start, then a word start, then anywhere. Entries already
 * chosen (case-insensitive) are left out. An empty query returns the first entries, which are the most common ones.
 */
export function suggest(list: readonly string[], query: string, exclude: readonly string[] = [], limit = 8): string[] {
  const q = norm(query)
  const taken = new Set(exclude.map(norm))
  const pool = list.filter((item) => !taken.has(norm(item)))
  if (!q) return pool.slice(0, limit)
  const scored: { item: string; rank: number; index: number }[] = []
  pool.forEach((item, index) => {
    const n = norm(item)
    let rank = -1
    if (n === q) rank = 0
    else if (n.startsWith(q)) rank = 1
    else if (n.split(/[\s/.\-(]+/).some((w) => w.startsWith(q))) rank = 2
    else if (n.includes(q)) rank = 3
    if (rank >= 0) scored.push({ item, rank, index })
  })
  return scored.sort((a, b) => a.rank - b.rank || a.index - b.index).slice(0, limit).map((s) => s.item)
}
