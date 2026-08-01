<?php
include __DIR__ . '/../includes/db_connect.php';
header('Content-Type: application/json');

$sections = [];
try {
    $result = $conn->query("SELECT DISTINCT section_name AS section FROM section_config ORDER BY section_name");
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $sections[] = $row['section'];
        }
    }
} catch (Exception $e) {
    echo json_encode(["status" => "error", "message" => "Database error: " . $e->getMessage()]);
    $conn->close();
    exit;
}

echo json_encode(["status" => "success", "sections" => $sections]);
$conn->close();
?>
