pipeline {
    agent any
    environment {
        AWS_REGION = "ap-south-1"
        ECR_REPO = "356627769740.dkr.ecr.ap-south-1.amazonaws.com/myapp"
        CLUSTER = "Blue_Green_Cluster"
        SERVICE = "Blue_Green-service-b7ifaw2f"
        TARGET_GROUP_GREEN = "arn:aws:elasticloadbalancing:ap-south-1:356627769740:targetgroup/BlueDeployment/6931a5cf0af3eaec"
        LISTENER_ARN = "arn:aws:elasticloadbalancing:ap-south-1:356627769740:listener/app/ALBLoadbalancerBluegreen/c4e8f0d58f601261/f09c0f6b6d27d58c"
    }
    stages {
        stage('Checkout') {
            steps {
                git branch: 'main',
                    url: 'https://github.com/GiribabuGBB/Blue_Green_Deployment.git'
            }
        }
        stage('Build Docker Image') {
            steps {
                sh '''
                docker build -t myapp:${BUILD_NUMBER} .
                docker tag myapp:${BUILD_NUMBER} $ECR_REPO:${BUILD_NUMBER}
                '''
            }
        }
        stage('Login to ECR') {
            steps {
                withCredentials([aws(
                    credentialsId: 'aws-creds',
                    accessKeyVariable: 'AWS_ACCESS_KEY_ID',
                    secretKeyVariable: 'AWS_SECRET_ACCESS_KEY'
                )]) {
                    sh '''
                        aws ecr get-login-password --region $AWS_REGION | \
                        docker login --username AWS --password-stdin $ECR_REPO
                    '''
                }
            }
        }
        stage('Push to ECR') {
            steps {
                withCredentials([aws(
                    credentialsId: 'aws-creds',
                    accessKeyVariable: 'AWS_ACCESS_KEY_ID',
                    secretKeyVariable: 'AWS_SECRET_ACCESS_KEY'
                )]) {
                    sh 'docker push $ECR_REPO:${BUILD_NUMBER}'
                }
            }
        }
        stage('Update Task Definition') {
            steps {
                withCredentials([aws(
                    credentialsId: 'aws-creds',
                    accessKeyVariable: 'AWS_ACCESS_KEY_ID',
                    secretKeyVariable: 'AWS_SECRET_ACCESS_KEY'
                )]) {
                    sh """
                    # Get current task definition ARN
                    TASK_DEF=\$(aws ecs describe-services \
                      --cluster ${CLUSTER} \
                      --services ${SERVICE} \
                      --region ${AWS_REGION} \
                      --query 'services[0].taskDefinition' \
                      --output text)

                    echo "Current task def: \$TASK_DEF"

                    # Export task definition JSON
                    aws ecs describe-task-definition \
                      --task-definition \$TASK_DEF \
                      --region ${AWS_REGION} \
                      --query 'taskDefinition' > /tmp/taskdef.json

                    # Update image and remove read-only fields using python3
                    python3 << 'PYEOF'
import json

with open('/tmp/taskdef.json') as f:
    d = json.load(f)

# Update image tag
for c in d.get('containerDefinitions', []):
    if '${ECR_REPO}' in c.get('image', ''):
        c['image'] = '${ECR_REPO}:${BUILD_NUMBER}'
        print(f"Updated image to: {c['image']}")

# Remove read-only fields
for k in ['taskDefinitionArn','revision','status','requiresAttributes','compatibilities','registeredAt','registeredBy']:
    d.pop(k, None)

with open('/tmp/taskdef_new.json', 'w') as f:
    json.dump(d, f, indent=2)

print("Task definition updated successfully")
PYEOF

                    # Register new task definition revision
                    NEW_TASK_DEF=\$(aws ecs register-task-definition \
                      --region ${AWS_REGION} \
                      --cli-input-json file:///tmp/taskdef_new.json \
                      --query 'taskDefinition.taskDefinitionArn' \
                      --output text)

                    echo "New task def: \$NEW_TASK_DEF"

                    # Update ECS service with new task definition
                    aws ecs update-service \
                      --cluster ${CLUSTER} \
                      --service ${SERVICE} \
                      --task-definition \$NEW_TASK_DEF \
                      --force-new-deployment \
                      --region ${AWS_REGION}
                    """
                }
            }
        }
        stage('Health Check') {
            steps {
                sh '''
                echo "Waiting for ECS to start new task..."
                sleep 120
                '''
            }
        }
        stage('Switch Traffic') {
            steps {
                withCredentials([aws(
                    credentialsId: 'aws-creds',
                    accessKeyVariable: 'AWS_ACCESS_KEY_ID',
                    secretKeyVariable: 'AWS_SECRET_ACCESS_KEY'
                )]) {
                    sh """
                        aws elbv2 modify-listener \
                        --listener-arn ${LISTENER_ARN} \
                        --default-actions Type=forward,TargetGroupArn=${TARGET_GROUP_GREEN} \
                        --region ${AWS_REGION}
                    """
                }
            }
        }
    }
}
