# Requirements Document

## Introduction

本文档定义了AI漫剧创作平台中用户认证会话管理的bug修复需求。当前系统存在会话验证不完整的问题：应用启动时仅检查localStorage中是否存在用户数据，但不验证JWT token的有效性。这导致token过期或无效时，用户仍被导航到项目列表页面，随后所有API请求返回401错误。

## Glossary

- **Session_Manager**: 会话管理器，负责验证和维护用户登录状态
- **JWT_Token**: JSON Web Token，用于API认证的令牌，有效期24小时
- **User_Data**: 存储在localStorage中的用户信息（id, email, name, isAdmin）
- **Auth_State**: 认证状态，包括已登录、未登录、会话过期
- **API_Request**: 向后端服务器发送的HTTP请求

## Requirements

### Requirement 1

**User Story:** As a returning user, I want the application to validate my session on startup, so that I am redirected to login if my session has expired.

#### Acceptance Criteria

1. WHEN the application starts with stored User_Data THEN the Session_Manager SHALL validate the JWT_Token before displaying the home view
2. IF the JWT_Token is expired or invalid THEN the Session_Manager SHALL clear localStorage and redirect to the auth view
3. IF the JWT_Token is valid THEN the Session_Manager SHALL proceed to display the home view
4. WHILE validating the session THEN the system SHALL display a loading indicator

### Requirement 2

**User Story:** As a user making API requests, I want the application to handle authentication failures gracefully, so that I am logged out and can re-authenticate when my session expires.

#### Acceptance Criteria

1. WHEN an API_Request returns 401 Unauthorized THEN the Session_Manager SHALL clear the stored session data
2. WHEN an API_Request returns 401 Unauthorized THEN the Session_Manager SHALL redirect the user to the auth view
3. WHEN handling a 401 error THEN the system SHALL display a notification explaining the session has expired
4. WHEN the user is logged out due to 401 THEN the system SHALL preserve the current URL for post-login redirect

### Requirement 3

**User Story:** As a user, I want the WebSocket connection to handle authentication failures, so that I am notified when my session is invalid.

#### Acceptance Criteria

1. WHEN the Socket_Connection fails due to authentication error THEN the system SHALL display an error notification
2. WHEN the Socket_Connection authentication fails THEN the Session_Manager SHALL trigger a session validation
3. IF session validation fails after socket auth error THEN the system SHALL redirect to the auth view

### Requirement 4

**User Story:** As a developer, I want a centralized session management utility, so that authentication logic is consistent across the application.

#### Acceptance Criteria

1. WHEN validating a session THEN the Session_Manager SHALL use a single utility function
2. WHEN clearing a session THEN the Session_Manager SHALL remove both User_Data and JWT_Token from localStorage
3. WHEN checking auth state THEN the Session_Manager SHALL provide a consistent interface for all components

