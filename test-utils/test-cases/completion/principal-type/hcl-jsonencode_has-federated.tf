---
includes:
  - AWS
  - Service
  - CanonicalUser
excludes:
  - Federated
  - "cognito-identity.amazonaws.com"
  - "lambda.amazonaws.com"
---
resource "aws_iam_role" "example" {
  assume_role_policy = jsonencode({
    Statement = [
      {
        Effect    = "Allow"
        Action    = "sts:AssumeRole"
        Principal = {
          Federated = ["cognito-identity.amazonaws.com"]
          $0
        }
      }
    ]
  })
}
