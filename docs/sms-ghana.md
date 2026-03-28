# Master Prompt for AI Agent: Build a Complete High School Management Web App for Ghana
You are a Senior Software Architect, Product Manager, Business Analyst, UX Designer, Database Architect, Security Engineer, QA Lead, DevOps Engineer, and Education Domain Specialist.
Your task is to help me design and build a complete, production-ready, web-based High School Management System for Ghana.
This system will be used by a secondary/high school administration to manage the school’s full day-to-day operations, from student admission to graduation, including academics, finance, HR, boarding/hostel, stores, exeat, and other operational workflows.
You must think and work like a top-tier enterprise solution architect and engineering team.
Do not give shallow output.
Do not give generic SaaS ideas.
Do not skip implementation detail.
Do not leave important modules undefined.
I want a full solution blueprint and build-ready implementation plan, including system architecture, modules, database design, APIs, workflows, dashboards, roles, permissions, and execution steps.

## 1. Product Objective
Build a comprehensive school administration web app for a high school in Ghana that digitizes and streamlines school operations across:
- student lifecycle management
- admissions
- academic administration
- examinations and report cards
- class and subject management
- teacher and staff management
- HR and payroll support
- boarding/hostel management
- student attendance
- exeat management
- fees and finance
- supply/store/inventory operations
- disciplinary records
- parent communication
- document and records management
- alumni/graduation tracking
- analytics and reporting
- audit trail and accountability
The platform should support both day schools and boarding schools.
The system must be suitable for the operational realities of Ghanaian high schools, including:
- term/semester-based academic calendar
- day and boarding students
- houses/hostels/dormitories
- fee categories and installment payments
- admissions workflow
- class/promotions/transfers/graduation
- core and elective subjects
- continuous assessment and exams
- supply and inventory controls
- staff roles across academic and non-academic operations

## 2. Core Mission of the System
The system should help a school:
- manage the full student journey from application/admission to graduation
- manage academic structure, classes, departments, programmes, and subjects
- manage assessments, exams, terminal reports, and transcripts
- manage school fees, billing, payments, and financial records
- manage teachers, non-teaching staff, HR records, and payroll-related workflows
- manage boarding/hostel allocation and welfare
- manage student movement through exeat and return tracking
- manage store items, supplies, and issue records
- manage student discipline, health, and welfare records where appropriate
- generate operational and statutory reports
- provide role-based access for administrators, teachers, accountants, housemasters/housemistresses, parents, students, and support staff

## 3. What You Must Produce
You must help me produce a complete solution in structured phases.
Your output should include:
A. Product Discovery and Requirements
- product vision
- problem statement
- goals and success metrics
- stakeholder analysis
- user personas
- functional requirements
- non-functional requirements
- assumptions and constraints
- in-scope and out-of-scope items
- module breakdown
B. System Design
- high-level architecture
- monolith vs modular monolith vs microservices recommendation
- frontend architecture
- backend architecture
- database architecture
- authentication and authorization design
- file/document storage approach
- notifications design
- reporting and analytics design
- audit logging strategy
- backup and recovery strategy
C. Domain Modeling
- entities and relationships
- ERD-level thinking
- data ownership boundaries
- module interactions
- workflow definitions
- state transitions for key entities
D. Engineering Design
- folder/project structure
- API standards
- coding conventions
- validation standards
- error handling standards
- testing strategy
- deployment architecture
- observability and monitoring
- security hardening checklist
E. Build Plan
- phased implementation roadmap
- sprint/module order
- dependency order
- milestone outputs
- acceptance criteria per module
F. Implementation Assets
Generate detailed:
- SQL schema design
- backend endpoint plan
- frontend page/screen inventory
- component inventory
- role-permission matrix
- report inventory
- notification inventory
- sample workflows
- sample seed data structure

## 4. Users and Roles
Design the system to support at least the following roles. You may refine or expand them if needed.
Administrative Roles
- Super Admin
- School Administrator / Headmaster / Headmistress
- Assistant Head
- Academic Coordinator
- Admissions Officer
- Registrar
- Finance Officer / Accountant
- HR Officer
- Store Keeper / Procurement Officer
- Boarding Master / Boarding Mistress / Housemaster / Housemistress
- Librarian
- School Nurse / Welfare Officer
- IT/Admin Support
Academic Roles
- Teacher
- Subject Teacher
- Form Master / Class Teacher
- Examination Officer
- Guidance and Counseling Officer
End User Roles
- Student
- Parent / Guardian
- Alumni
Optional Operational Roles
- Security Officer / Gate Officer
- Kitchen / Dining Supervisor
- Transport Officer
- Maintenance Officer
Create a proper Role-Based Access Control matrix showing exactly who can view, create, edit, approve, delete, export, and audit what.

## 5. Major Modules to Include
You must design the system with the following modules.

5.1 Dashboard and Administration Module
Features:
- role-based dashboards
- school profile setup
- term/semester/session setup
- academic year setup
- department/programme/class structure setup
- subject setup
- school houses/hostels setup
- fee structure setup
- grading rules setup
- system settings
- user management
- role and permission management
- announcement center
- audit logs
- activity tracking
Dashboards should differ by role.
For example:
- admin dashboard
- academic dashboard
- finance dashboard
- boarding dashboard
- teacher dashboard
- parent dashboard
- student dashboard

5.2 Admissions and Enrollment Module
This should manage the process from applicant to admitted student.
Features:
- online admission application
- applicant biodata capture
- previous school history
- programme/class selection
- guardian/parent details
- uploaded documents
- entrance exam/interview records
- admission status workflow
- admission decision
- offer generation
- acceptance workflow
- enrollment conversion
- student ID generation
- placement into programme/class/house/hostel
- admissions reporting
Statuses should include things like:
- draft
- submitted
- under review
- shortlisted
- exam scheduled
- interviewed
- admitted
- rejected
- accepted
- enrolled

5.3 Student Information Management Module
Manage full student records after admission.
Features:
- student master profile
- student ID and admission number
- personal information
- demographic data
- parent/guardian linkage
- emergency contacts
- medical notes (configurable and access-controlled)
- programme/class/form/year tracking
- day/boarding status
- house/hostel assignment
- student documents
- student status lifecycle
Student statuses should support:
- active
- suspended
- withdrawn
- transferred
- completed
- graduated
- alumni
- deceased
Include student promotion, repetition, transfer, and graduation workflows.

5.4 Academic Structure and Curriculum Module
Features:
- academic calendar
- terms/semesters
- departments
- programmes
- forms/year groups
- classes/streams
- subject catalog
- core and elective subject classification
- class-subject assignment
- teacher-subject assignment
- timetable support readiness
- curriculum mapping
- grading and assessment rules
Design this module so a school can define:
- which subjects belong to which programme
- which classes belong to which programme/year
- which teachers teach which subjects/classes

5.5 Attendance Management Module
Features:
- daily attendance by class
- subject attendance
- staff attendance
- boarding attendance / roll call support
- lateness tracking
- absentee reporting
- attendance summaries
- parent notifications for absenteeism
- term attendance analytics
Support:
- present
- absent
- excused
- late
- sick
- on approved leave/exeat

5.6 Assessment, Examination, and Results Module
This is a critical module.
Features:
- assessment setup
- continuous assessment categories
- assignments/tests/quizzes/projects
- exam setup by term
- mark entry by teachers
- mark approval workflow
- grading engine
- class positions/ranking rules if enabled
- comments by class teacher/form master
- terminal report generation
- transcript generation
- broadsheet generation
- result publication workflow
- result locking
- correction and audit handling
Support Ghana school realities such as:
- continuous assessment plus exams
- weighted grading
- term reports
- promotion decisions
- cumulative performance records
Include validation rules such as:
- score range checks
- missing subject detection
- subject-teacher-class consistency
- publish only after approval

5.7 Timetable and Scheduling Module
Features:
- class timetable
- teacher timetable
- exam timetable
- room allocation
- conflict detection
- printable schedules
- timetable views for teachers/students/admin

5.8 Finance and Fees Management Module
This must be robust.
Features:
- fee structure setup by class/programme/boarding status
- billing engine
- student ledger
- invoices and receipts
- payment recording
- payment channels integration readiness
- installment plans
- discounts/scholarships/bursaries
- arrears tracking
- debtor reporting
- finance dashboard
- revenue reporting
- cashbook-related summaries
- fee balance checks
- payment history
- refund/adjustment controls
- audit trail for all finance actions
Support categories such as:
- tuition
- boarding
- feeding
- PTA dues
- exam fees
- admission fees
- utility charges
- miscellaneous charges
Include ability to:
- generate bills in bulk
- post charges in bulk
- record partial payments
- restrict some actions when arrears exceed thresholds
- export finance reports

5.9 HR and Staff Management Module
Features:
- staff biodata
- staff categories: teaching / non-teaching
- department assignment
- appointment details
- qualification records
- contract details
- leave management
- staff attendance
- performance notes
- payroll support readiness
- salary component configuration
- staff document storage
- disciplinary records
- separation/retirement/resignation tracking
Optional payroll scope:
- salary structure setup
- allowances
- deductions
- net salary calculation
- payroll batch
- payslip generation
If full payroll is too large for MVP, design it cleanly for phased rollout.

5.10 Boarding / Hostel Management Module
This is essential for boarding schools.
Features:
- house/hostel setup
- dormitory/room/bed structure
- boarding student assignment
- room/bed allocation
- occupancy tracking
- hostel capacity management
- boarding roster
- boarding attendance/check-ins
- housemaster/housemistress management
- student movement within hostel
- hostel incident records
- boarding reports
Support:
- no over-allocation
- active occupancy register
- room transfer workflow
- boarding status history

5.11 Exeat Management Module
Important for boarding schools in Ghana.
Features:
- exeat request creation
- exeat types
- destination details
- guardian approval details where needed
- approval workflow
- departure logging
- return logging
- overdue exeat tracking
- gate verification
- boarding-master oversight dashboard
- exeat history
Support exeat types like:
- day exeat
- weekend exeat
- emergency exeat
- medical exeat
- vacation leave
Statuses:
- requested
- pending approval
- approved
- rejected
- departed
- returned
- overdue
- cancelled
Integrate with:
- boarding module
- attendance
- student status
- parent notification

5.12 Supply, Stores, and Inventory Module
Features:
- item catalog
- item categories
- stock intake
- stock issue
- store balance
- supplier records
- reorder level alerts
- issue-to-department records
- issue-to-staff records
- issue-to-hostel/class records
- stock adjustments
- stock count reconciliation
- damaged/expired/lost item handling
- inventory reports
Support items such as:
- stationery
- cleaning supplies
- food items
- hostel consumables
- lab items
- sports equipment
- textbooks
- uniforms

5.13 Discipline, Welfare, and Student Support Module
Features:
- disciplinary incident recording
- sanctions and actions
- counseling records
- welfare notes
- behavior monitoring
- commendations/awards
- parent engagement notes
- case follow-up workflow
Access must be tightly controlled.

5.14 Parent and Student Portal Module
Features:
- secure parent login
- secure student login
- view profile
- view attendance
- view results/report cards
- view fee balance and payment history
- view announcements
- exeat status visibility where relevant
- message/communication access
- downloadable documents
Parents should be able to see linked children only.

5.15 Communication and Notifications Module
Features:
- in-app notifications
- email/SMS readiness
- fee reminders
- admission updates
- result publication notices
- absentee alerts
- overdue exeat alerts
- admin announcements
- staff notices
Build a notification event model so future communication channels can plug in easily.

5.16 Document and Records Management Module
Features:
- student document uploads
- staff document uploads
- admission attachments
- report archives
- policy documents
- downloadable forms
- file tagging/categorization
- secure access controls
- retention policy support

5.17 Graduation, Completion, and Alumni Module
Features:
- graduation eligibility checks
- completion processing
- exit records
- transcript generation
- testimonial/certificate support readiness
- alumni conversion
- alumni profile records
- historical archive

5.18 Reporting and Analytics Module
Features:
- enrollment reports
- admissions reports
- attendance reports
- academic performance reports
- finance reports
- boarding occupancy reports
- exeat movement reports
- inventory reports
- HR/staff reports
- audit reports
- export to PDF/Excel/CSV where relevant
Build reporting with filters such as:
- term
- academic year
- class
- programme
- gender
- boarding/day
- department
- status

## 6. Key Workflows to Design Carefully
You must fully define workflows, data states, and approvals for these:
- applicant to admitted student to enrolled student
- student promotion to next class/year
- student transfer, withdrawal, suspension, graduation
- teacher mark entry to approval to publication
- finance billing to payment to receipt to ledger reconciliation
- staff onboarding to active employment to exit
- hostel assignment to room transfer to occupancy tracking
- exeat request to approval to departure to return
- stock receipt to issue to reconciliation
- report generation and archival
- parent/student viewing rights and approvals
- audit trail generation for sensitive actions
For every workflow:
- define actors
- triggers
- validations
- states
- actions
- notifications
- exceptions
- audit events

## 7. Ghana-Specific Context You Should Respect
Design the system with Ghanaian secondary school operations in mind.
Consider realities such as:
- academic year with terms/semesters
- SHS operational patterns
- boarding and day student mix
- house/dormitory systems
- school fee structures and partial payments
- parent/guardian involvement
- manual paper-heavy operations that need digitization
- intermittent power/internet risks
- need for print-friendly reports and exports
- affordability and maintainability
- mobile-responsive access for admin and parents
Do not make the system dependent on expensive enterprise infrastructure.

## 8. Non-Functional Requirements
The system must meet strong non-functional standards.
Include and design for:
Performance
- fast page load times
- responsive data tables
- efficient search and filtering
- scalable architecture for growing student/staff numbers
Security
- strong authentication
- RBAC and permission checks
- audit logs
- encrypted passwords
- secure session management
- validation on all inputs
- protection against common web vulnerabilities
- secure file uploads
- finance and disciplinary data protection
Reliability
- backups
- restore procedures
- transactional consistency
- error handling
- idempotent operations where appropriate
Usability
- intuitive admin workflows
- simple navigation
- mobile responsiveness
- printable reports
- accessible forms
- dashboard clarity
Maintainability
- modular architecture
- clean code separation
- reusable services/components
- documented APIs
- test coverage
Compliance-mindedness
- privacy-aware design
- controlled access to sensitive records
- auditability
- data retention awareness

## 9. Technical Expectations
You must recommend and justify a modern, practical stack.
Preferred direction:
- modern web app
- responsive frontend
- robust backend API
- relational database
- secure authentication
- production-ready architecture
Unless there is a better justified alternative, optimize for:
- React or Next.js frontend
- Node.js/NestJS or Laravel/Django backend
- PostgreSQL database
- Redis where useful
- object/file storage for uploads
- Dockerized deployment
- CI/CD readiness
But do not blindly choose tools.
First evaluate and recommend the best architecture for:
- speed of development
- maintainability
- affordability
- suitability for school administration workloads
- long-term extensibility
Also define:
- API style: REST or GraphQL and why
- background job handling
- report generation approach
- document storage approach
- export strategy
- notification/event architecture

## 10. Database Design Expectations
You must define a serious data model.
At minimum, create detailed schema planning for entities such as:
- users
- roles
- permissions
- user_role assignments
- students
- student_guardians
- guardians
- applicants
- admissions
- academic_years
- terms/semesters
- departments
- programmes
- classes
- subjects
- class_subjects
- teacher_assignments
- enrollments
- attendance_records
- assessments
- exams
- score_entries
- result_sheets
- grading_scales
- report_cards
- invoices
- fee_structures
- student_ledgers
- payments
- receipts
- staff
- staff_departments
- payroll_batches
- hostels
- dormitories
- rooms
- beds
- hostel_allocations
- exeat_requests
- exeat_movements
- inventory_items
- stock_transactions
- stock_issues
- suppliers
- disciplinary_cases
- announcements
- notifications
- documents
- audit_logs
- graduation_records
- alumni_records
For each important table, define:
- purpose
- core fields
- keys
- relationships
- constraints
- statuses/enums
- indexing considerations

## 11. API Design Expectations
Design clear APIs for all major modules.
For each module, define:
- endpoint groups
- request/response patterns
- validation rules
- permissions required
- business rules
- status codes
- filtering/search needs
- bulk action support
- import/export endpoints where needed
Examples:
- admissions APIs
- student APIs
- class and subject APIs
- mark entry APIs
- fee and payment APIs
- hostel allocation APIs
- exeat APIs
- inventory APIs
- reporting APIs
Also define:
- auth endpoints
- profile endpoints
- dashboard endpoints
- notification endpoints
- audit endpoints

## 12. Frontend and UX Expectations
Design the UI/UX for real school administrators, not engineers.
Create:
- page inventory
- navigation structure
- dashboard layouts
- forms and tables strategy
- create/edit/view workflows
- approval screens
- reporting screens
- parent portal screens
- student portal screens
- mobile behavior expectations
Important UX requirements:
- easy-to-use forms
- bulk import where appropriate
- quick search across students/staff/items
- smart filters
- print-friendly views
- clean dashboards with operational summaries
- low-friction navigation between modules
- clear empty states and validation feedback

## 13. Imports, Exports, and Bulk Operations
The system should support operational efficiency.
Include support for:
- bulk student import
- bulk staff import
- bulk billing
- bulk subject assignment
- bulk results upload where permitted
- bulk promotion
- bulk hostel assignment where safe
- export to Excel/CSV/PDF where needed
- downloadable templates for imports
Also define:
- import validation strategy
- preview-before-commit
- row-level error reporting
- rollback rules for failed imports

## 14. Audit, Security, and Sensitive Data
This part must be taken seriously.
Define:
- audit events for major changes
- who changed what and when
- old vs new value tracking for critical records
- finance audit trails
- disciplinary record access control
- result publication controls
- hostel/exeat approval traceability
- login and access logs
- failed action logs where necessary
Sensitive records include:
- finance
- staff data
- student disciplinary records
- medical/welfare records
- admissions decisions
- exam/result edits

## 15. Reports to Include
At minimum, include the following report categories:
Admissions
- applicant list
- admitted students
- rejected applicants
- enrollment conversion rate
Student Management
- student register
- class list
- gender distribution
- day vs boarding breakdown
- student status report
Academics
- class performance
- subject performance
- broadsheet
- terminal report
- promotion list
- graduation eligibility
- transcript
Attendance
- student attendance summary
- class attendance report
- staff attendance report
- absentee list
Finance
- billed vs paid
- debtor list
- payment collections
- fee balance by class
- revenue summary by period
- discount/bursary report
HR
- staff list
- department staff count
- leave report
- staff attendance report
Boarding / Exeat
- hostel occupancy
- room availability
- active exeat list
- overdue exeat report
- student return log
Stores
- stock balance
- stock movement
- low stock items
- supplier transaction summary
Audit / Admin
- user activity logs
- approval logs
- data change logs

## 16. Suggested Build Strategy
Use a phased approach.
Phase 1: Discovery and Planning
Produce:
- business requirements
- module list
- user roles
- workflows
- architecture recommendation
- ERD
- roadmap
Phase 2: Core Platform Foundation
Build:
- authentication
- authorization
- user management
- school setup
- academic year/term setup
- audit logging
- notification foundation
Phase 3: Admissions + Student Information
Build:
- applicants
- admissions workflow
- enrollment
- student profile
- guardian linkage
- student lifecycle actions
Phase 4: Academic Administration
Build:
- departments/programmes/classes/subjects
- teacher assignments
- attendance
- assessments
- exams
- results/report cards
Phase 5: Finance
Build:
- fee structure
- billing
- invoices
- ledger
- payments
- receipts
- finance reports
Phase 6: HR and Staff
Build:
- staff records
- staff attendance
- leave
- employment records
- payroll readiness
Phase 7: Boarding + Exeat
Build:
- hostel structures
- student allocation
- occupancy
- exeat workflow
- return tracking
Phase 8: Stores and Inventory
Build:
- item catalog
- stock intake
- stock issue
- supplier records
- reconciliation reports
Phase 9: Portals + Reporting
Build:
- parent portal
- student portal
- reports center
- exports
- analytics dashboards
Phase 10: Hardening and Deployment
Build:
- tests
- security hardening
- seed data
- CI/CD
- backup plan
- deployment scripts
- documentation

## 17. Output Format Required From You
Respond in a structured way and do not skip detail.
Use this exact sequence:
- Executive summary
- Product vision
- Stakeholders and user roles
- Functional requirements by module
- Non-functional requirements
- Core workflows
- Recommended architecture and tech stack
- Database design and core entities
- RBAC matrix
- API design outline
- Frontend page/screen inventory
- Reports inventory
- Notifications/events inventory
- Implementation roadmap by phase
- Risks and mitigation
- MVP vs Phase 2 vs Phase 3 scope
- Developer handoff package
- Suggested folder structure
- Test strategy
- Deployment architecture
- Next steps to begin implementation

## 18. Engineering Quality Bar
Your work must be:
- implementation-oriented
- explicit
- modular
- scalable
- realistic
- not vague
- not overengineered without reason
- suitable for real deployment
Whenever you propose a feature, also define:
- why it exists
- what data it needs
- who can use it
- what rules govern it
- what output/report it produces
Whenever you define a module, include:
- purpose
- users
- entities
- workflows
- screens
- APIs
- reports
Whenever you define a table or API, think like a production engineer.

## 19. Important Constraints
- The app is for a high school in Ghana.
- It must cover administrative realities from admissions to graduation.
- It must support both day and boarding school scenarios.
- It must include finance, academics, HR, boarding, stores, and exeat.
- It must be web-based and mobile-responsive.
- It must use strong role-based permissions.
- It must be designed for future extensibility.
- It must be practical for phased implementation.
- It must not ignore auditability and security.

## 20. Final Instruction
Act like you are the lead architect responsible for delivering this product from concept to production.
Do not provide generic summaries only.
Break the solution into detailed, build-ready, engineering-grade deliverables.
Where useful, provide:
- tables
- entity lists
- workflow states
- endpoint groups
- phased task lists
- implementation notes
- architecture decisions with reasons
Your goal is to produce a complete blueprint that a serious engineering team or AI coding agent can use to build the product.
