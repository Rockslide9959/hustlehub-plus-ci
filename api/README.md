# HustleHub+ — Part 1: Secure Foundations

> **Module:** Information Systems 3D (INSY7314/w) / Application Development Security (APDS7311/w)  
> **Assessment:** Portfolio of Evidence: Part 1  
> **Current scope:** Secure backend foundations only
> **Demonstration Video Link:** https://youtu.be/OyUOsZ8iuRY

Team Members

| Name | Student Number |
|---|---|
| Ethan Jansen | ST10440914 |
| Thabo Setsubi | St10445734 |
| Sam Sossen | ST10445164 |
| Amaan Tesfaye | ST10287107 |


## 1. Project Overview

**HustleHub+** is a secure freelance marketplace platform designed to connect **freelancers** with **clients**.

The completed system will allow freelancers to advertise services, clients to browse and book those services, and the platform to record booking-related transactions. It will also later provide freelancers with income tracking and estimated tax information.

For **Part 1**, the project focuses only on the secure backend foundation of the application. The main objective is to build a **Node.js and Express REST API** that provides secure user registration, login, password protection, token-based authentication, input validation, HTTPS communication, and controlled error handling.

The full marketplace functionality, React frontend, MongoDB database, gig management, bookings, transactions, income tracking, role-based access control, and tax calculations will be implemented in later parts of the POE.

---

## 2. Intended Users

HustleHub+ is designed for three main user types:

### Clients
Clients will eventually be able to:
- Create an account and log in.
- Browse freelancer gigs.
- Book available services.
- View information related to their bookings.

### Freelancers
Freelancers will eventually be able to:
- Create an account and log in.
- Create and manage their own gigs.
- View bookings for their services.
- Track income generated from bookings.
- View estimated tax information.

### Administrators
Administrators will later have elevated access for managing and monitoring the platform.

> In **Part 1**, the focus is authentication and secure backend foundations. Full role-based access control is part of the later development stages.

---

## 3. Part 1 Scope

The Part 1 implementation focuses on the following requirements:

- Node.js and Express backend API.
- User registration.
- User login.
- Secure password hashing.
- JSON Web Token (JWT) generation after successful authentication.
- JWT validation for protected API requests.
- Local development over HTTPS.
- Input validation before requests are processed.
- Safe and controlled error responses.
- Temporary local, file-based, or in-memory user storage.
- Postman testing for valid and invalid authentication scenarios.
- Clear separation of routes, controllers, middleware, and data-handling logic.

### 4. Request Flow

A typical authentication request follows this process:

1. A user sends a request to the API over **HTTPS**.
2. The Express route receives the request.
3. Input is validated before being passed to application logic.
4. The controller handles the registration or login request.
5. Passwords are hashed or verified securely.
6. When login succeeds, the server generates a JWT.
7. The token is returned to the authenticated user.
8. Future protected requests must include the JWT.
9. Authentication middleware validates the token before access is allowed.
10. Errors are returned using controlled responses that do not expose internal application details.

---

## 5. Backend Structure

```text
hustlehub-plus/
│
├── src/
│   ├── controllers/
│   │   └── authController.js
│   │
│   ├── middleware/
│   │   ├── authMiddleware.js
│   │   ├── validationMiddleware.js
│   │   └── errorMiddleware.js
│   │
│   ├── routes/
│   │   └── authRoutes.js
│   │
│   ├── models/
│   │   └── userModel.js
│   │
│   ├── data/
│   │   └── users.json
│   │
│   ├── app.js
│   └── server.js
│
├── cert/
│   ├── cert.pem
│   └── key.pem
│
├── postman/
│   └── HustleHub-Part1.postman_collection.json
│
├── screenshots/
│
├── .env
├── .gitignore
├── package.json
└── README.md
```

### Main Responsibilities

| Component | Responsibility |
|---|---|
| **Routes** | Define API endpoints and connect requests to controllers. |
| **Controllers** | Handle registration, login, and other application logic. |
| **Middleware** | Perform authentication checks, validation, and error handling. |
| **Models/Data Layer** | Represent and store user data. |
| **Server** | Starts the Express application using HTTPS. |
| **Configuration** | Stores environment-specific settings such as the JWT secret and port. |

---

## 6. Authentication

### 6.1 User Registration

During registration, the backend should:

1. Receive the user's registration details.
2. Validate all required fields.
3. Reject invalid or malicious input.
4. Check whether the user already exists.
5. Hash the password before it is stored.
6. Store only the hashed password.
7. Return a controlled success response.

A plain-text password must **never** be stored.

### 6.2 User Login

During login, the backend should:

1. Receive the user's login credentials.
2. Validate the supplied input.
3. Find the matching user.
4. Compare the supplied password with the stored password hash.
5. Reject invalid credentials using a controlled error response.
6. Generate a JWT when authentication succeeds.
7. Return the token to the user.

### 6.3 JWT Authentication

JWT is used to identify authenticated users after login.


Authentication middleware should:

1. Check whether a token is present.
2. Extract the token from the request.
3. Verify the token using the server's JWT secret.
4. Reject expired, malformed, or invalid tokens.
5. Allow the request to continue only when the token is valid.

---

## 7. Security Decisions

Security is a primary requirement because HustleHub+ processes user credentials and will later process transaction and income-related information.

### 7.1 Password Hashing

Passwords are never stored in plain text.

A secure password-hashing algorithm should be used before storing user credentials. Hashing protects users because the original password is not directly recoverable from the stored value.

When a user logs in, the application verifies the supplied password against the stored hash rather than decrypting a stored password.

### 7.2 Token-Based Authentication

JWT is used because HTTP requests are independent and the backend must be able to identify authenticated users on later requests.

After successful login:

- The server creates a signed JWT.
- The client stores the token temporarily.
- The client includes the token with protected API requests.
- The server validates the token on every protected request.

This prevents protected routes from relying only on information supplied by the client.

### 7.3 Input Validation

All input must be treated as untrusted.

Validation should be applied before application logic is executed. Examples include:

- Required fields must be present.
- Email addresses must follow an acceptable format.
- Passwords must satisfy the project's password rules.
- Unexpected values must be rejected.
- Incorrect data types must be rejected.
- Requests containing malformed data must not be processed.

Validation reduces the risk of invalid or malicious data entering the application.

### 7.4 HTTPS

The API must run over **HTTPS** during local development using a locally configured SSL certificate.

HTTPS protects data while it travels between the client and the backend by encrypting the connection. This is especially important for:

- Passwords.
- Login credentials.
- JWTs.
- Future financial and transaction information.

### 7.5 Safe Error Handling

The backend should provide controlled and consistent error responses.

The API must not return:

- Stack traces.
- Server file paths.
- Environment variables.
- JWT secrets.
- Internal configuration values.
- Raw internal error objects.

---

## 8. API Functionality

At minimum, Part 1 contains authentication functionality.

| Method | Route | Authentication | Purpose |
|---|---|---:|---|
| `POST` | `/api/auth/register` | No | Register a new user. |
| `POST` | `/api/auth/login` | No | Authenticate a user and return a JWT. |
| Protected routes | Project-specific | Yes | Require a valid JWT before processing the request. |

> Route names can be adjusted to match the actual implementation. The README should always reflect the routes that exist in the submitted code.

---

### Required Test Scenarios

| Test | Expected Result |
|---|---|
| Valid registration | User is created successfully. |
| Duplicate registration | Request is rejected safely. |
| Registration with missing fields | Validation error is returned. |
| Registration with invalid input | Request is rejected. |
| Valid login | JWT is returned. |
| Incorrect password | Login is rejected. |
| Unknown user | Login is rejected. |
| Missing login fields | Validation error is returned. |
| Protected request with valid JWT | Request is allowed. |
| Protected request without JWT | Request is rejected. |
| Protected request with invalid JWT | Request is rejected. |


## 9. Demonstration Video

The Part 1 demonstration video should show:

1. The API starting successfully.
2. The application running over HTTPS.
3. Successful user registration.
4. Handling of invalid registration input.
5. Successful login.
6. JWT generation.
7. At least one protected request using the token.

**Demonstration Video Link:** https://youtu.be/OyUOsZ8iuRY

---
