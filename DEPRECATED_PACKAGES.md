# Deprecated Packages

This document tracks deprecated packages in the project and recommended upgrade paths.

## Frontend Dependencies

### react-beautiful-dnd (v13.1.1) - DEPRECATED
- **Status**: Deprecated as of 2023
- **Current Usage**: Drag-and-drop functionality for Kanban board
- **Impact**: Still works but no longer maintained
- **Recommended Migration**: 
  - Migrate to [@dnd-kit](https://github.com/clauderic/dnd-kit)
  - Or use [react-dnd](https://github.com/react-dnd/react-dnd)
- **Priority**: Medium (plan for future major version)
- **References**: https://github.com/atlassian/react-beautiful-dnd/issues/2672

## Backend Dependencies (Dev Dependencies)

### supertest (v6.3.4) - OUTDATED
- **Status**: Outdated
- **Recommendation**: Upgrade to v7.1.3+
- **Impact**: Works fine for current testing needs
- **Priority**: Low

## Transitive Dependencies (Auto-resolved by frameworks)

The following are transitive dependencies (managed by react-scripts and other tools):
- Various @babel plugins (migrated to ECMAScript standard)
- svgo (v1.3.2) - upgrade to v2.x handled by react-scripts update
- eslint (v8.x) - bundled with react-scripts

## Action Plan

1. **Immediate**: No action required - all code working as expected
2. **Next Minor Release**: Consider upgrading supertest
3. **Next Major Release**: 
   - Migrate from react-beautiful-dnd to @dnd-kit
   - Consider upgrading react-scripts to latest version
   - Review and update other dependencies

## Notes

- All deprecated packages are either dev dependencies or have working alternatives
- No security vulnerabilities in production dependencies
- Focus on stable functionality over latest versions for production
