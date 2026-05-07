pipeline {
    agent any

    options {
        timestamps()
        timeout(time: 20, unit: 'MINUTES')
        disableConcurrentBuilds()
        ansiColor('xterm')
        buildDiscarder(logRotator(numToKeepStr: '20'))
    }

    triggers {
        githubPush()
    }

    environment {
        COMPOSE_FILE = 'docker-compose.dev.yml'
        SERVICE_NAME = 'api'
        HEALTH_URL   = 'http://localhost:3111/docs'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                sh 'git rev-parse --short HEAD > .git-sha'
                script {
                    env.GIT_SHA = readFile('.git-sha').trim()
                    currentBuild.displayName = "#${BUILD_NUMBER} (${env.GIT_SHA})"
                }
            }
        }

        stage('Verify env file') {
            steps {
                sh '''
                    set -e
                    if [ ! -f /opt/seoul-moment/.env.dev ]; then
                        echo "ERROR: /opt/seoul-moment/.env.dev not found on host."
                        echo "Create it before running this pipeline (see deploy/dev/README.md)."
                        exit 1
                    fi
                '''
            }
        }

        stage('Build image') {
            steps {
                sh '''
                    set -e
                    docker compose -f $COMPOSE_FILE build --pull
                '''
            }
        }

        stage('Deploy') {
            steps {
                sh '''
                    set -e
                    docker compose -f $COMPOSE_FILE up -d --remove-orphans
                '''
            }
        }

        stage('Health check') {
            steps {
                sh '''
                    set -e
                    for i in $(seq 1 30); do
                        if curl -fsS -o /dev/null "$HEALTH_URL"; then
                            echo "Health check passed (attempt $i)"
                            exit 0
                        fi
                        echo "Waiting for app... ($i/30)"
                        sleep 3
                    done
                    echo "Health check failed. Recent logs:"
                    docker compose -f $COMPOSE_FILE logs --tail=200 $SERVICE_NAME
                    exit 1
                '''
            }
        }

        stage('Cleanup') {
            steps {
                sh 'docker image prune -f'
            }
        }
    }

    post {
        failure {
            sh '''
                echo "Build failed. Last 200 lines of container logs:"
                docker compose -f $COMPOSE_FILE logs --tail=200 $SERVICE_NAME || true
            '''
        }
    }
}
