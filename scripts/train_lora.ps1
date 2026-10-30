# Train the style LoRA with kohya sd-scripts on ComfyUI's embedded python (it is the venv with
# working torch+CUDA, see CLAUDE.md). Parameters = those of the original, good rbkstyle.safetensors
# (read back from its ss_* metadata): dim/alpha 32/32, lr 1e-4 constant, AdamW8bit, 512px, batch 1.
# v2-v4 used alpha 16 and 8x fewer steps — likely part of why they regressed.
#
#   powershell -File scripts/train_lora.ps1 -Dataset raw\lora_dataset_v5 -Name rbkstyle_v5 [-Epochs 6]
# Stop ComfyUI first: both fight for the 6 GB of VRAM.
param(
    [Parameter(Mandatory)][string]$Dataset,   # parent dir that holds <repeats>_rbkstyle/
    [Parameter(Mandatory)][string]$Name,
    [int]$Epochs = 6
)
$comfy = 'C:\Users\SS\ComfyUI_windows_portable'
$py = "$comfy\python_embeded\python.exe"
$out = "$comfy\ComfyUI\models\loras"
$data = (Resolve-Path $Dataset).Path
Push-Location C:\Users\SS\sd-scripts
try {
    & $py -m accelerate.commands.launch --num_cpu_threads_per_process 4 train_network.py `
        --pretrained_model_name_or_path "$comfy\ComfyUI\models\checkpoints\anything-v5.safetensors" `
        --train_data_dir $data --output_dir $out --output_name $Name `
        --resolution 512,512 --train_batch_size 1 --max_train_epochs $Epochs --save_every_n_epochs 2 `
        --network_module networks.lora --network_dim 32 --network_alpha 32 `
        --learning_rate 1e-4 --lr_scheduler constant --optimizer_type AdamW8bit `
        --mixed_precision fp16 --save_precision fp16 --gradient_checkpointing --cache_latents `
        --caption_extension .txt --seed 3923177122 --save_model_as safetensors `
        --enable_bucket --min_bucket_reso 256 --max_bucket_reso 768 --sdpa
} finally { Pop-Location }
