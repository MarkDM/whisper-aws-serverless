import subprocess
import sys
import os
import json
import boto3

s3 = boto3.client('s3')

def lambda_handler(event, context):
    print(json.dumps(event))
    bucket_name = event['Records'][0]['s3']['bucket']['name']
    object_key = event['Records'][0]['s3']['object']['key']
    print(f"Processing file {object_key} from bucket {bucket_name}")

    # Download the audio file from S3
    audio_file = "/tmp/audio.wav"
    s3.download_file(bucket_name, object_key, audio_file)

    #check if file exists
    if not os.path.exists(audio_file):
        raise FileNotFoundError(f"WAV file not found: {audio_file}")   

    # Process the audio file
    result = process_audio(audio_file)

    # Upload the result back to S3
    result_key = f"processed/{object_key}.json"
    s3.put_object(Bucket=bucket_name, Key=result_key, Body=json.dumps(result))

    return {
        'statusCode': 200,
        'body': json.dumps('Processing complete')
    }


def process_audio(wav_file, model_name="tiny"):
    """
    Processes an audio file using a specified model and returns the processed string.

    :param wav_file: Path to the WAV file
    :param model_name: Name of the model to use
    :return: Processed string output from the audio processing
    :raises: Exception if an error occurs during processing
    """

    model = f"models/ggml-{model_name}.bin"

    # Check if the file exists
    if not os.path.exists(model):
        raise FileNotFoundError(
            f"Model file not found: {model} \n\nDownload a model with this command:\n\n> bash ./models/download-ggml-model.sh {model_name}\n\n")

    if not os.path.exists(wav_file):
        raise FileNotFoundError(f"WAV file not found: {wav_file}")

    # Get the absolute path to whisper-cli in Lambda environment
    whisper_cli = os.path.join(os.environ.get('LAMBDA_TASK_ROOT', '.'), 'bin', 'whisper-cli')
    
    # Set LD_LIBRARY_PATH to include the bin directory for shared libraries
    env = os.environ.copy()
    bin_path = os.path.join(os.environ.get('LAMBDA_TASK_ROOT', '.'), 'bin')
    existing_ld_path = env.get('LD_LIBRARY_PATH', '')
    env['LD_LIBRARY_PATH'] = f"{bin_path}:{existing_ld_path}" if existing_ld_path else bin_path
    
    # whisper.cpp command format: ./main -m model.bin -f input.wav -nt (no timestamps) -np (no print progress)
    full_command = f"{whisper_cli} -m {model} -f {wav_file} -nt"

    # Execute the command
    process = subprocess.Popen(
        full_command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)

    # Get the output and error (if any)
    output, error = process.communicate()

    # Check if process failed (non-zero exit code)
    if process.returncode != 0:
        error_msg = error.decode('utf-8') if error else 'Unknown error'
        raise Exception(f"Error processing audio (exit code {process.returncode}): {error_msg}")

    # Process and return the output string
    decoded_str = output.decode('utf-8').strip()
    processed_str = decoded_str.replace('[BLANK_AUDIO]', '').strip()

    return processed_str


def main():
    if len(sys.argv) >= 2:
        wav_file = sys.argv[1]
        model_name = sys.argv[2] if len(sys.argv) == 3 else "tiny"
        try:
            result = process_audio(wav_file, model_name)
            print(result)
        except Exception as e:
            print(f"Error: {e}")
    else:
        print("Usage: python whisper_processor.py <wav_file> [<model_name>]")


if __name__ == "__main__":
    main()
