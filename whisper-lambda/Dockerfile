#Build comands
# docker build -t whisper-lambda . SQS_QUEUE_URL=<sqs_queue_url>
# docker tag whisper-lambda:latest <aws_account_id>.dkr.ecr.<region>.amazonaws.com/whisper-lambda:latest
# aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <aws_account_id>.dkr.ecr.<region>.amazonaws.com
# docker push <aws_account_id>.dkr.ecr.<region>.amazonaws.com/whisper-lambda:latest

FROM public.ecr.aws/lambda/python:3.12

# Install build tools and dependencies
RUN dnf install -y \
    gcc \
    gcc-c++ \
    cmake \
    make \
    git \
    && dnf clean all

# Build whisper.cpp from source to ensure compatibility with Lambda environment
WORKDIR /tmp
RUN git clone https://github.com/ggml-org/whisper.cpp.git && \
    cd whisper.cpp && \
    cmake -B build && \
    cmake --build build -j --config Release && \
    cp -r build/* ${LAMBDA_TASK_ROOT}/ && \
    chmod +x ${LAMBDA_TASK_ROOT}/bin/whisper-cli && \
    cd /tmp && \
    rm -rf whisper.cpp

# Copy models and Python code
COPY models/ ${LAMBDA_TASK_ROOT}/models/
COPY transcript.py ${LAMBDA_TASK_ROOT}/

# Install boto3 for S3 operations
#RUN pip install boto3

# Set working directory
WORKDIR ${LAMBDA_TASK_ROOT}

# Set environment variable for SQS queue URL during build time
ARG SQS_QUEUE_URL
ENV SQS_QUEUE_URL=${SQS_QUEUE_URL}

CMD ["transcript.lambda_handler"]