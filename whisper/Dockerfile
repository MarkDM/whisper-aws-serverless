FROM public.ecr.aws/lambda/python:3.11

# Install build tools and dependencies
RUN yum install -y \
    gcc \
    gcc-c++ \
    cmake3 \
    make \
    git \
    && yum clean all && \
    ln -s /usr/bin/cmake3 /usr/bin/cmake

# Build whisper.cpp from source to ensure compatibility with Lambda environment
WORKDIR /tmp
RUN git clone https://github.com/ggml-org/whisper.cpp.git && \
    cd whisper.cpp && \
    cmake -B build && \
    cmake --build build -j --config Release && \
    mkdir -p ${LAMBDA_TASK_ROOT}/bin && \
    cp build/bin/whisper-cli ${LAMBDA_TASK_ROOT}/bin/ && \
    cp build/src/libwhisper.so* ${LAMBDA_TASK_ROOT}/bin/ 2>/dev/null || true && \
    chmod +x ${LAMBDA_TASK_ROOT}/bin/whisper-cli

# Copy models and Python code
COPY models/ ${LAMBDA_TASK_ROOT}/models/
COPY transcript.py ${LAMBDA_TASK_ROOT}/

# Install boto3 for S3 operations
#RUN pip install boto3

# Set working directory
WORKDIR ${LAMBDA_TASK_ROOT}

CMD ["transcript.lambda_handler"]