#!/bin/bash

# =============================================================================
# Solidity to PolkaVM Compilation Script for QF Network
# =============================================================================
# 
# This script compiles Solidity smart contracts to PolkaVM bytecode using the
# Revive compiler. The Revive compiler is a fork of Solc that targets the
# PolkaVM architecture instead of the EVM.
#
# PREREQUISITES:
#   - Revive compiler binary installed and available in PATH
#     Installation: https://github.com/paritytech/revive
#   - Solidity source files in the contracts/ directory
#
# USAGE:
#   ./scripts/compile-revive.sh <solidity-file> [output-name]
#
# EXAMPLES:
#   ./scripts/compile-revive.sh contracts/QNSRegistrar.sol
#   ./scripts/compile-revive.sh contracts/QNSRegistry.sol QNSRegistry
#
# OUTPUT:
#   - output/<name>.polkavm   - PolkaVM bytecode for deployment
#   - output/<name>.abi       - Contract ABI (JSON)
#   - output/<name>.bin       - Raw bytecode (hex)
#
# =============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_DIR="$PROJECT_ROOT/output"

# =============================================================================
# Helper Functions
# =============================================================================

print_header() {
    echo -e "${BLUE}"
    echo "============================================================================="
    echo "  Revive Compiler - Solidity → PolkaVM"
    echo "============================================================================="
    echo -e "${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# =============================================================================
# Main Script
# =============================================================================

print_header

# Check arguments
if [ $# -lt 1 ]; then
    print_error "Usage: $0 <solidity-file> [output-name]"
    echo ""
    echo "Examples:"
    echo "  $0 contracts/QNSRegistrar.sol"
    echo "  $0 contracts/QNSRegistry.sol MyRegistry"
    exit 1
fi

INPUT_FILE="$1"
OUTPUT_NAME="${2:-$(basename "$INPUT_FILE" .sol)}"

# Resolve input file path
if [[ ! "$INPUT_FILE" = /* ]]; then
    INPUT_FILE="$PROJECT_ROOT/$INPUT_FILE"
fi

# Validate input file
if [ ! -f "$INPUT_FILE" ]; then
    print_error "Solidity file not found: $INPUT_FILE"
    exit 1
fi

print_info "Input file: $INPUT_FILE"
print_info "Output name: $OUTPUT_NAME"

# Create output directory
mkdir -p "$OUTPUT_DIR"
print_success "Created output directory: $OUTPUT_DIR"

# Check for revive compiler
if ! command -v revive &> /dev/null; then
    print_error "Revive compiler not found in PATH"
    echo ""
    echo "Please install the Revive compiler:"
    echo "  1. Clone the repository:"
    echo "     git clone https://github.com/paritytech/revive"
    echo "  2. Follow the build instructions in the repository"
    echo "  3. Add the binary to your PATH"
    echo ""
    echo "Alternatively, download a pre-built binary from:"
    echo "  https://github.com/paritytech/revive/releases"
    exit 1
fi

REVIDE_VERSION=$(revive --version 2>/dev/null || echo "unknown")
print_success "Found Revive compiler: $REVIDE_VERSION"

# =============================================================================
# Compilation
# =============================================================================

echo ""
print_info "Starting compilation..."
echo ""

# Compilation flags for Revive
# --target polkavm    : Target the PolkaVM architecture (required)
# --abi               : Generate ABI output
# --bin               : Generate binary output
# --optimize          : Enable optimization
# --output-dir        : Output directory for compiled files

COMPILE_CMD=(
    revive
    --target polkavm
    --abi
    --bin
    --optimize
    --output-dir "$OUTPUT_DIR"
    "$INPUT_FILE"
)

print_info "Running: ${COMPILE_CMD[*]}"
echo ""

if ! "${COMPILE_CMD[@]}"; then
    print_error "Compilation failed!"
    exit 1
fi

# =============================================================================
# Post-Processing
# =============================================================================

echo ""
print_success "Compilation completed successfully!"
echo ""

# Rename output files to consistent naming
CONTRACT_NAME=$(basename "$INPUT_FILE" .sol)

# Find the generated files
for file in "$OUTPUT_DIR"/*; do
    if [[ "$(basename "$file")" == *.polkavm ]]; then
        mv "$file" "$OUTPUT_DIR/$OUTPUT_NAME.polkavm"
        print_success "Bytecode: output/$OUTPUT_NAME.polkavm"
    elif [[ "$(basename "$file")" == *.abi ]]; then
        mv "$file" "$OUTPUT_DIR/$OUTPUT_NAME.abi"
        print_success "ABI:      output/$OUTPUT_NAME.abi"
    elif [[ "$(basename "$file")" == *.bin ]]; then
        mv "$file" "$OUTPUT_DIR/$OUTPUT_NAME.bin"
        print_success "Binary:   output/$OUTPUT_NAME.bin"
    fi
done

# Copy ABI to src/abi for the frontend
ABI_DEST="$PROJECT_ROOT/src/abi/$OUTPUT_NAME.json"
if [ -f "$OUTPUT_DIR/$OUTPUT_NAME.abi" ]; then
    # Convert ABI to JSON format expected by the frontend
    cat "$OUTPUT_DIR/$OUTPUT_NAME.abi" > "$ABI_DEST"
    print_success "Copied ABI to: src/abi/$OUTPUT_NAME.json"
fi

# =============================================================================
# Summary
# =============================================================================

echo ""
echo "============================================================================="
echo "  📦 Compilation Summary"
echo "============================================================================="
echo ""

POLKAVM_SIZE=$(stat -f%z "$OUTPUT_DIR/$OUTPUT_NAME.polkavm" 2>/dev/null || stat -c%s "$OUTPUT_DIR/$OUTPUT_NAME.polkavm" 2>/dev/null || echo "unknown")

echo "  Contract:     $CONTRACT_NAME"
echo "  Output Name:  $OUTPUT_NAME"
echo "  Bytecode:     output/$OUTPUT_NAME.polkavm ($POLKAVM_SIZE bytes)"
echo "  ABI:          output/$OUTPUT_NAME.abi"
echo ""

print_info "Next step: Deploy the contract"
echo "  DEPLOYER_MNEMONIC='your mnemonic' \\"
echo "  BYTECODE_PATH='./output/$OUTPUT_NAME.polkavm' \\"
echo "  ABI_PATH='./src/abi/$OUTPUT_NAME.json' \\"
echo "  npx ts-node scripts/deploy-substrate.ts"
echo ""
