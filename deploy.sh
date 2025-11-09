#!/bin/bash

# BeautyBite Website Deployment Script
# Automated deployment with rollback capabilities

set -e  # Exit on any error

# Configuration
REPO_URL="https://github.com/harrisonfar123/BeautyBite.git"
BRANCH="main"
DEPLOYMENT_LOG="deployment.log"
BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$DEPLOYMENT_LOG"
}

error_log() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a "$DEPLOYMENT_LOG"
}

warning_log() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" | tee -a "$DEPLOYMENT_LOG"
}

# Pre-deployment checks
pre_deploy_checks() {
    log "Starting pre-deployment checks..."
    
    # Check if git is available
    if ! command -v git &> /dev/null; then
        error_log "Git is not installed"
        exit 1
    fi
    
    # Check if required files exist
    if [ ! -f "src/index.html" ]; then
        error_log "src/index.html not found"
        exit 1
    fi
    
    if [ ! -f "src/styles.css" ]; then
        error_log "src/styles.css not found"
        exit 1
    fi
    
    # Validate HTML structure
    log "Validating HTML structure..."
    if ! command -v htmlhint &> /dev/null; then
        warning_log "htmlhint not installed, skipping HTML validation"
    else
        if ! htmlhint src/index.html; then
            error_log "HTML validation failed"
            exit 1
        fi
    fi
    
    # Check for broken image references
    log "Checking image references..."
    missing_images=0
    while IFS= read -r img; do
        if [ ! -f "$img" ] && [[ "$img" != "https://"* ]]; then
            error_log "Missing image file: $img"
            missing_images=$((missing_images + 1))
        fi
    done < <(grep -o 'src="[^"]*"' src/index.html | sed 's/src="//g' | sed 's/"//g')
    
    if [ $missing_images -gt 0 ]; then
        error_log "$missing_images image references are broken"
        exit 1
    fi
    
    log "Pre-deployment checks completed successfully"
}

# Create backup
create_backup() {
    log "Creating backup of current deployment..."
    
    if [ ! -d "backups" ]; then
        mkdir -p backups
    fi
    
    mkdir -p "$BACKUP_DIR"
    
    # Copy static files
    cp -r src/* "$BACKUP_DIR/" 2>/dev/null || true
    cp *.md "$BACKUP_DIR/" 2>/dev/null || true
    cp *.webp "$BACKUP_DIR/" 2>/dev/null || true
    cp *.png "$BACKUP_DIR/" 2>/dev/null || true
    
    log "Backup created at $BACKUP_DIR"
}

# Deploy to production
deploy() {
    log "Starting deployment process..."
    
    # Add all changes
    git add .
    
    # Check if there are changes to commit
    if ! git diff --cached --quiet; then
        log "Committing changes..."
        git commit -m "Deploy BeautyBite website - $(date '+%Y-%m-%d %H:%M:%S')"
        git push origin "$BRANCH"
        log "Changes pushed to remote repository"
    else
        log "No changes to deploy"
    fi
    
    # Wait for GitHub Actions to complete
    log "Waiting for deployment to complete..."
    sleep 10
    
    log "Deployment process completed"
}

# Rollback function
rollback() {
    if [ -z "$1" ]; then
        error_log "Usage: $0 rollback <backup_directory>"
        exit 1
    fi
    
    local backup_dir="$1"
    
    if [ ! -d "$backup_dir" ]; then
        error_log "Backup directory $backup_dir not found"
        exit 1
    fi
    
    log "Starting rollback to $backup_dir..."
    
    # Restore files from backup
    cp -r "$backup_dir"/* . 2>/dev/null || true
    
    # Commit rollback
    git add .
    git commit -m "Rollback to $backup_dir - $(date '+%Y-%m-%d %H:%M:%S')"
    git push origin "$BRANCH"
    
    log "Rollback completed successfully"
}

# Health check
health_check() {
    log "Performing health check..."
    
    # Check if GitHub Pages is accessible
    if command -v curl &> /dev/null; then
        local url="https://harrisonfar123.github.io/BeautyBite/"
        if curl -s --head "$url" > /dev/null; then
            log "Health check passed: $url is accessible"
        else
            warning_log "Health check failed: $url may not be accessible"
        fi
    else
        warning_log "curl not available, skipping health check"
    fi
}

# Main deployment function
main() {
    case "${1:-deploy}" in
        "deploy")
            pre_deploy_checks
            create_backup
            deploy
            health_check
            log "Deployment completed successfully!"
            ;;
        "rollback")
            rollback "$2"
            ;;
        "health")
            health_check
            ;;
        "backup")
            create_backup
            ;;
        *)
            echo "Usage: $0 {deploy|rollback|health|backup}"
            echo "  deploy    - Run full deployment process (default)"
            echo "  rollback  - Rollback to specified backup"
            echo "  health    - Perform health check"
            echo "  backup    - Create backup only"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"