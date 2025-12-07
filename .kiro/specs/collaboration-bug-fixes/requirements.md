# Requirements Document

## Introduction

本文档定义了AI漫剧创作团队管理平台中团队协作功能的bug修复需求。系统当前存在多个协作相关的问题，包括状态同步循环、用户身份识别错误、数据不同步、权限检查不完整等。本次修复旨在确保多人实时协作功能的稳定性和安全性。

## Glossary

- **Collaboration_System**: 团队协作系统，负责多用户实时同步项目数据
- **Socket_Connection**: WebSocket连接，用于实时双向通信
- **Project_State**: 项目状态，包含分镜、资产、剧集等数据
- **Role**: 用户角色，包括admin（管理员）、editor（编辑者）、viewer（查看者）
- **Remote_Update**: 来自其他协作用户的数据更新
- **Local_Update**: 当前用户本地的数据更新
- **Active_User**: 当前在线并加入项目房间的用户
- **Member**: 项目成员，包括在线和离线用户

## Requirements

### Requirement 1

**User Story:** As a team member, I want the collaboration system to correctly distinguish between local and remote updates, so that the system does not enter an infinite sync loop.

#### Acceptance Criteria

1. WHEN the Collaboration_System receives a Remote_Update THEN the system SHALL update local state without triggering a broadcast back to the server
2. WHEN a user makes a Local_Update THEN the Collaboration_System SHALL broadcast the change to other users only once
3. WHILE the Collaboration_System is processing updates THEN the system SHALL maintain a flag to differentiate update sources
4. IF the system detects a potential sync loop THEN the Collaboration_System SHALL skip the redundant broadcast

### Requirement 2

**User Story:** As a user joining a project via invite link, I want to see the actual project data immediately, so that I can start collaborating without seeing placeholder content.

#### Acceptance Criteria

1. WHEN a user joins a project via invite link THEN the Collaboration_System SHALL wait for server confirmation before displaying the workspace
2. WHEN the server sends project-state event THEN the Collaboration_System SHALL update the Workspace component with the actual Project_State
3. IF the project does not exist on the server THEN the system SHALL display an error message and redirect to home
4. WHEN project data is loading THEN the system SHALL display a loading indicator

### Requirement 3

**User Story:** As a team member viewing the member list, I want to correctly identify myself in the list, so that I know which entry represents me.

#### Acceptance Criteria

1. WHEN displaying the member list THEN the system SHALL compare member IDs with the current logged-in user ID
2. WHEN the current user is found in the member list THEN the system SHALL display a "(我)" indicator next to their name
3. WHEN displaying offline members THEN the system SHALL show their full name from the server data

### Requirement 4

**User Story:** As a project admin, I want the permission system to properly validate all operations, so that unauthorized users cannot modify project data.

#### Acceptance Criteria

1. WHEN a user attempts to update project data THEN the Socket_Connection SHALL verify the user belongs to the project
2. WHEN a user attempts to update project data THEN the Socket_Connection SHALL verify the user has editor or admin Role
3. IF an unauthorized update attempt is detected THEN the system SHALL reject the operation and log the attempt
4. WHEN a new user joins via invite link THEN the system SHALL NOT automatically create projects for non-existent project IDs

### Requirement 5

**User Story:** As a developer, I want the Auth component to return consistent user data types, so that the application state remains type-safe.

#### Acceptance Criteria

1. WHEN a user logs in successfully THEN the Auth component SHALL return user data with id, email, name, and isAdmin fields
2. WHEN storing user data in localStorage THEN the system SHALL include all required fields
3. WHEN the CollaborationProvider receives user data THEN the system SHALL use consistent user ID format

### Requirement 6

**User Story:** As a team member, I want the socket connection to automatically recover from disconnections, so that I can continue collaborating after network issues.

#### Acceptance Criteria

1. WHEN the Socket_Connection disconnects THEN the system SHALL attempt to reconnect automatically
2. WHEN the Socket_Connection reconnects THEN the system SHALL rejoin the project room
3. WHEN reconnection fails THEN the system SHALL display an error notification to the user
4. WHILE disconnected THEN the system SHALL queue Local_Updates for later sync

### Requirement 7

**User Story:** As a developer, I want all intervals and timers to be properly cleaned up, so that there are no memory leaks when components unmount.

#### Acceptance Criteria

1. WHEN the Workspace component unmounts THEN the system SHALL clear all active intervals
2. WHEN the Workspace component unmounts THEN the system SHALL clear all active timeouts
3. WHEN the CollaborationProvider unmounts THEN the system SHALL disconnect the socket cleanly
