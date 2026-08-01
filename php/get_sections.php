<?php
include __DIR__ . '/../includes/db_connect.php';
header('Content-Type: application/json');

$instructor = $_GET['instructor'] ?? '';

if (empty($instructor)) {
    echo json_encode(["status" => "error", "message" => "instructor required"]);
    exit;
}

$sections = [];
try {
    $stmt = $conn->prepare("SELECT section_name, max_score FROM section_config WHERE instructor=? ORDER BY section_name");
    if ($stmt) {
        $stmt->bind_param("s", $instructor);
        $stmt->execute();
        $result = $stmt->get_result();
        while ($row = $result->fetch_assoc()) {
            $sections[] = $row;
        }
        $stmt->close();
    }
} catch (Exception $e) {
    echo json_encode(["status" => "error", "message" => "Database error: " . $e->getMessage()]);
    $conn->close();
    exit;
}

echo json_encode(["status" => "success", "sections" => $sections]);
$conn->close();
?>
