# CCS HUB API Documentation

## Base URL
\http://localhost:8000/api/v1\

## Authentication
All endpoints (except login/register) require JWT authentication.

### Headers
\\\
Authorization: Bearer <access_token>
\\\

## Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /auth/register | Register new user |
| POST | /auth/login | Login user |
| POST | /auth/refresh | Refresh token |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /users | List users |
| GET | /users/{id} | Get user details |

### Posts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /posts | List posts |
| POST | /posts | Create post |
