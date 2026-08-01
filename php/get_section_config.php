<?php
include __DIR__ . '/../includes/db_connect.php';
header('Content-Type: application/json');

$instructor = $_GET['instructor'] ?? '';
$section_name = $_GET['section_name'] ?? '';

if (empty($instructor) || empty($section_name)) {
    echo json_encode(["status" => "error", "message" => "instructor and section_name required"]);
    exit;
}

try {
    $stmt = $conn->prepare("SELECT max_score FROM section_config WHERE instructor=? AND section_name=?");
    if ($stmt) {
        $stmt->bind_param("ss", $instructor, $section_name);
        $stmt->execute();
        $result = $stmt->get_result();
        $row = $result->fetch_assoc();
        $stmt->close();
    } else {
        $row = null;
    }
} catch (Exception $e) {
    echo json_encode(["status" => "error", "message" => "Database error: " . $e->getMessage()]);
    $conn->close();
    exit;
}

if ($row) {
    echo json_encode(["status" => "success", "max_score" => intval($row['max_score'])]);
} else {
    echo json_encode(["status" => "success", "max_score" => 1000]);
}
$conn->close();
?>
