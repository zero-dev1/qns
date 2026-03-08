// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IQNSRegistry {
    function owner(bytes32 node) external view returns (address);
}

contract QNSResolver {

    IQNSRegistry public registry;
    address public contractOwner;

    mapping(bytes32 => address) public addresses;
    mapping(address => bytes32) public reverseNodes;
    mapping(bytes32 => string) public names;
    mapping(bytes32 => mapping(string => string)) public texts;
    mapping(address => bool) public authorizedCallers;

    event AddrChanged(bytes32 indexed node, address addr);
    event TextChanged(bytes32 indexed node, string key, string value);

    modifier onlyContractOwner() {
        require(msg.sender == contractOwner, "QNSResolver: not contract owner");
        _;
    }

    constructor(address registryAddress) {
        registry = IQNSRegistry(registryAddress);
        contractOwner = msg.sender;
    }

    function isAuthorized(bytes32 node) internal view returns (bool) {
        return msg.sender == registry.owner(node) || authorizedCallers[msg.sender];
    }

    function setAddr(bytes32 node, address addr) external {
        require(isAuthorized(node), "QNSResolver: not authorized");
        addresses[node] = addr;
        emit AddrChanged(node, addr);
    }

    function addr(bytes32 node) public view returns (address) {
        return addresses[node];
    }

    function setReverse(address _addr, bytes32 node) external {
        require(
            msg.sender == _addr || authorizedCallers[msg.sender],
            "QNSResolver: not authorized for reverse"
        );
        reverseNodes[_addr] = node;
    }

    function clearReverse(address _addr) external {
        require(
            msg.sender == _addr || authorizedCallers[msg.sender],
            "QNSResolver: not authorized for reverse"
        );
        delete reverseNodes[_addr];
    }

    function setName(bytes32 node, string memory _name) external {
        require(isAuthorized(node), "QNSResolver: not authorized");
        names[node] = _name;
    }

    function name(bytes32 node) public view returns (string memory) {
        return names[node];
    }

    function reverseResolve(address _addr) public view returns (string memory) {
        bytes32 node = reverseNodes[_addr];
        if (node == bytes32(0)) {
            return "";
        }
        return string(abi.encodePacked(names[node], ".qf"));
    }

    function nameHash(address _addr) public view returns (bytes32) {
        return reverseNodes[_addr];
    }

    function setText(bytes32 node, string memory key, string memory value) external {
        require(isAuthorized(node), "QNSResolver: not authorized");
        texts[node][key] = value;
        emit TextChanged(node, key, value);
    }

    function text(bytes32 node, string memory key) public view returns (string memory) {
        return texts[node][key];
    }

    function addAuthorizedCaller(address caller) external onlyContractOwner {
        authorizedCallers[caller] = true;
    }

    function removeAuthorizedCaller(address caller) external onlyContractOwner {
        authorizedCallers[caller] = false;
    }
}
